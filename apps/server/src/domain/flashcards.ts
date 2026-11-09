// Flashcards: the cards of a deck belong to the subject and are shared;
// when each member sees a card again is theirs alone, scheduled by FSRS.
import { and, asc, eq, gte, inArray, isNull, lte, sql } from "drizzle-orm";
import { createEmptyCard, fsrs, generatorParameters, Rating, type Card as FsrsCard, type Grade } from "ts-fsrs";
import type { Db } from "../db/client.ts";
import { cardProposals, cards, cardStates, decks, reviews } from "../db/schema.ts";
import { requireRole } from "./access.ts";
import { changes, record } from "./activity.ts";
import { invalid, notFound } from "./errors.ts";

/** New cards a member starts per deck and day. */
export const NEW_PER_DAY = 20;

const scheduler = fsrs(generatorParameters({ enable_fuzz: true, maximum_interval: 365 }));

export interface DeckView {
  id: string;
  courseId: string;
  name: string;
  cards: number;
  /** Cards due for the member now, new ones within today's limit included. */
  due: number;
  new: number;
}

export interface CardView {
  id: string;
  deckId: string;
  front: string;
  back: string;
  source: string | null;
  due: string | null;
  state: number;
}

export interface CardDraft {
  front: string;
  back: string;
  source?: string | null;
}

const clean = (draft: CardDraft) => {
  const front = draft.front?.trim();
  const back = draft.back?.trim();
  if (!front || !back) throw invalid("card_incomplete", "Eine Karte braucht Vorder- und Rückseite.");
  return { front, back, source: draft.source?.trim() || null };
};

const startOfToday = (now: Date) => new Date(now.getFullYear(), now.getMonth(), now.getDate());

export function flashcardsOf(db: Db) {
  const deckOf = async (deckId: string) => {
    const deck = await db.query.decks.findFirst({ where: eq(decks.id, deckId) });
    if (!deck) throw notFound("unknown_deck");
    return deck;
  };

  /** How many new cards the member began in the deck today. */
  const begunToday = async (userId: string, deckId: string, now: Date) => {
    const rows = await db.execute<{ n: number }>(sql`
      select count(*)::int as n from (
        select r.card_id, min(r.reviewed_at) as first
        from ${reviews} r join ${cards} c on c.id = r.card_id
        where r.user_id = ${userId} and c.deck_id = ${deckId}
        group by r.card_id
      ) firsts where first >= ${startOfToday(now).toISOString()}`);
    return rows[0]?.n ?? 0;
  };

  const stateOf = (row: typeof cardStates.$inferSelect): FsrsCard => ({
    due: row.due,
    stability: row.stability,
    difficulty: row.difficulty,
    scheduled_days: row.scheduledDays,
    learning_steps: row.learningSteps,
    reps: row.reps,
    lapses: row.lapses,
    state: row.state,
    last_review: row.lastReview ?? undefined,
  } as FsrsCard);

  const deckView = async (userId: string, deck: typeof decks.$inferSelect, now: Date): Promise<DeckView> => {
    const [counts] = await db.execute<{ cards: number; due: number; unseen: number }>(sql`
      select count(*)::int as cards,
        count(*) filter (where s.due <= ${now.toISOString()})::int as due,
        count(*) filter (where s.card_id is null)::int as unseen
      from ${cards} c left join ${cardStates} s on s.card_id = c.id and s.user_id = ${userId}
      where c.deck_id = ${deck.id}`);
    const fresh = Math.min(counts?.unseen ?? 0, Math.max(0, NEW_PER_DAY - (await begunToday(userId, deck.id, now))));
    return { id: deck.id, courseId: deck.courseId, name: deck.name, cards: counts?.cards ?? 0, due: (counts?.due ?? 0) + fresh, new: fresh };
  };

  return {
    async decks(userId: string, courseId: string, now = new Date()): Promise<DeckView[]> {
      await requireRole(db, userId, courseId, "viewer");
      const rows = await db.select().from(decks).where(eq(decks.courseId, courseId)).orderBy(decks.name);
      return Promise.all(rows.map((deck) => deckView(userId, deck, now)));
    },

    async createDeck(userId: string, courseId: string, name: string) {
      await requireRole(db, userId, courseId, "editor");
      if (!name.trim()) throw invalid("missing_name");
      const [deck] = await db
        .insert(decks)
        .values({ courseId, name: name.trim(), createdBy: userId })
        .onConflictDoUpdate({ target: [decks.courseId, decks.name], set: { name: name.trim() } })
        .returning();
      if (deck!.createdAt.getTime() > Date.now() - 5_000) {
        await record(db, { courseId, actorId: userId, action: "deck.created", subjectId: deck!.id, subject: deck!.name });
      }
      return deck!;
    },

    async renameDeck(userId: string, deckId: string, name: string) {
      const deck = await deckOf(deckId);
      await requireRole(db, userId, deck.courseId, "editor");
      if (!name.trim()) throw invalid("missing_name");
      await db.update(decks).set({ name: name.trim() }).where(eq(decks.id, deckId));
      if (deck.name !== name.trim()) {
        await record(db, { courseId: deck.courseId, actorId: userId, action: "deck.renamed", subjectId: deckId, subject: name.trim(), details: { name: [deck.name, name.trim()] } });
      }
    },

    async deleteDeck(userId: string, deckId: string) {
      const deck = await deckOf(deckId);
      await requireRole(db, userId, deck.courseId, "editor");
      await db.delete(decks).where(eq(decks.id, deckId));
      await record(db, { courseId: deck.courseId, actorId: userId, action: "deck.deleted", subjectId: deckId, subject: deck.name });
    },

    async cards(userId: string, deckId: string): Promise<CardView[]> {
      const deck = await deckOf(deckId);
      await requireRole(db, userId, deck.courseId, "viewer");
      const rows = await db
        .select({ card: cards, due: cardStates.due, state: cardStates.state })
        .from(cards)
        .leftJoin(cardStates, and(eq(cardStates.cardId, cards.id), eq(cardStates.userId, userId)))
        .where(eq(cards.deckId, deckId))
        .orderBy(asc(cards.createdAt));
      return rows.map((r) => ({ ...r.card, due: r.due?.toISOString() ?? null, state: r.state ?? 0 }));
    },

    async addCard(userId: string, deckId: string, draft: CardDraft) {
      const deck = await deckOf(deckId);
      await requireRole(db, userId, deck.courseId, "editor");
      const [card] = await db.insert(cards).values({ deckId, ...clean(draft), createdBy: userId }).returning();
      await record(db, { courseId: deck.courseId, actorId: userId, action: "card.created", subjectId: card!.id, subject: card!.front.slice(0, 120), details: { deck: deck.name } });
      return card!;
    },

    async updateCard(userId: string, cardId: string, draft: CardDraft) {
      const card = await db.query.cards.findFirst({ where: eq(cards.id, cardId) });
      if (!card) throw notFound("unknown_card");
      const deck = await deckOf(card.deckId);
      await requireRole(db, userId, deck.courseId, "editor");
      const next = clean(draft);
      await db.update(cards).set({ ...next, updatedAt: new Date() }).where(eq(cards.id, cardId));
      const diff = changes(card, next);
      if (Object.keys(diff).length > 0) {
        await record(db, { courseId: deck.courseId, actorId: userId, action: "card.changed", subjectId: cardId, subject: next.front.slice(0, 120), details: { deck: deck.name, ...diff } });
      }
    },

    async deleteCard(userId: string, cardId: string) {
      const card = await db.query.cards.findFirst({ where: eq(cards.id, cardId) });
      if (!card) throw notFound("unknown_card");
      const deck = await deckOf(card.deckId);
      await requireRole(db, userId, deck.courseId, "editor");
      await db.delete(cards).where(eq(cards.id, cardId));
      await record(db, { courseId: deck.courseId, actorId: userId, action: "card.deleted", subjectId: cardId, subject: card.front.slice(0, 120), details: { deck: deck.name } });
    },

    /** What to study now: due cards first, then new ones up to today's limit. */
    async queue(userId: string, deckId: string, now = new Date()): Promise<CardView[]> {
      const deck = await deckOf(deckId);
      await requireRole(db, userId, deck.courseId, "viewer");
      const due = await db
        .select({ card: cards, state: cardStates })
        .from(cards)
        .innerJoin(cardStates, and(eq(cardStates.cardId, cards.id), eq(cardStates.userId, userId)))
        .where(and(eq(cards.deckId, deckId), lte(cardStates.due, now)))
        .orderBy(asc(cardStates.due));
      const room = Math.max(0, NEW_PER_DAY - (await begunToday(userId, deckId, now)));
      const fresh = room
        ? await db
            .select({ card: cards })
            .from(cards)
            .leftJoin(cardStates, and(eq(cardStates.cardId, cards.id), eq(cardStates.userId, userId)))
            .where(and(eq(cards.deckId, deckId), isNull(cardStates.cardId)))
            .orderBy(asc(cards.createdAt))
            .limit(room)
        : [];
      return [
        ...due.map((r) => ({ ...r.card, due: r.state.due.toISOString(), state: r.state.state })),
        ...fresh.map((r) => ({ ...r.card, due: null, state: 0 })),
      ];
    },

    /** Records an answer (1 again … 4 easy) and schedules the card anew. */
    async review(userId: string, cardId: string, rating: number, now = new Date()) {
      if (![1, 2, 3, 4].includes(rating)) throw invalid("invalid_rating");
      const card = await db.query.cards.findFirst({ where: eq(cards.id, cardId) });
      if (!card) throw notFound("unknown_card");
      await requireRole(db, userId, (await deckOf(card.deckId)).courseId, "viewer");
      const known = await db.query.cardStates.findFirst({ where: and(eq(cardStates.cardId, cardId), eq(cardStates.userId, userId)) });
      const before = known ? stateOf(known) : createEmptyCard(now);
      const next = scheduler.next(before, now, rating as Grade).card;
      const values = {
        due: next.due,
        stability: next.stability,
        difficulty: next.difficulty,
        elapsedDays: 0,
        scheduledDays: next.scheduled_days,
        learningSteps: next.learning_steps,
        reps: next.reps,
        lapses: next.lapses,
        state: next.state,
        lastReview: now,
      };
      await db
        .insert(cardStates)
        .values({ cardId, userId, ...values })
        .onConflictDoUpdate({ target: [cardStates.cardId, cardStates.userId], set: values });
      await db.insert(reviews).values({ cardId, userId, rating, reviewedAt: now });
      return { due: next.due.toISOString(), state: next.state };
    },

    /** What a member's due cards look like across all their subjects, for the home page. */
    async dueCounts(userId: string, courseIds: string[], now = new Date()) {
      if (courseIds.length === 0) return {} as Record<string, number>;
      const all = await db.select().from(decks).where(inArray(decks.courseId, courseIds));
      const counts: Record<string, number> = {};
      for (const deck of all) counts[deck.courseId] = (counts[deck.courseId] ?? 0) + (await deckView(userId, deck, now)).due;
      return counts;
    },

    // --- Proposals from Claude ----------------------------------------------

    async propose(userId: string, courseId: string, deckName: string, drafts: CardDraft[]) {
      await requireRole(db, userId, courseId, "viewer");
      if (!deckName.trim()) throw invalid("missing_name");
      if (drafts.length === 0 || drafts.length > 50) throw invalid("card_count", "1 bis 50 Karten je Aufruf.");
      const rows = drafts.map((d) => ({ courseId, userId, deckName: deckName.trim(), ...clean(d) }));
      await db.insert(cardProposals).values(rows);
      return rows.length;
    },

    async proposals(userId: string, courseId: string) {
      await requireRole(db, userId, courseId, "viewer");
      return db
        .select()
        .from(cardProposals)
        .where(and(eq(cardProposals.userId, userId), eq(cardProposals.courseId, courseId)))
        .orderBy(asc(cardProposals.createdAt));
    },

    /** Takes a proposal into its deck, optionally changed; the deck is made if needed. */
    async accept(userId: string, proposalId: string, change?: CardDraft) {
      const proposal = await db.query.cardProposals.findFirst({ where: and(eq(cardProposals.id, proposalId), eq(cardProposals.userId, userId)) });
      if (!proposal) throw notFound("unknown_proposal");
      const deck = await this.createDeck(userId, proposal.courseId, proposal.deckName);
      const card = await this.addCard(userId, deck.id, change ?? proposal);
      await db.delete(cardProposals).where(eq(cardProposals.id, proposalId));
      return card;
    },

    async reject(userId: string, proposalId: string) {
      await db.delete(cardProposals).where(and(eq(cardProposals.id, proposalId), eq(cardProposals.userId, userId)));
    },

    async studiedSince(userId: string, since: Date) {
      const rows = await db
        .select({ n: sql<number>`count(*)::int` })
        .from(reviews)
        .where(and(eq(reviews.userId, userId), gte(reviews.reviewedAt, since)));
      return rows[0]?.n ?? 0;
    },
  };
}

export { Rating };
