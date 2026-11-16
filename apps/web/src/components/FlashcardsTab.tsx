// Flashcards of a subject: decks shared by all members, studied by each at
// their own pace, and the cards Claude proposed waiting to be taken over.
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { atLeast } from "@study/shared";
import { Button, Card, Chip, EmptyState, IconButton, List, ListRow, Notice, SectionHeader, SegmentedControl, TextArea, TextField } from "@study/ui";
import { t, errorMessage, formatShortDate } from "../i18n";
import { api, type Card as FlashCard, type Course, type Deck, type Proposal } from "../lib/api";
import { ContextMenu, MenuItem, MenuSeparator, menuPositionFrom, type MenuPosition } from "./ContextMenu";
import { Rich } from "./Rich";

export function FlashcardsTab({ course }: { course: Course }) {
  const [decks, setDecks] = useState<Deck[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [mode, setMode] = useState<"study" | "cards">("study");
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canEdit = atLeast(course.role, "editor");

  const load = useCallback(async () => {
    try {
      const [d, p] = await Promise.all([api.decks(course.id), api.proposals(course.id)]);
      setDecks(d);
      setProposals(p);
      setSelected((current) => current ?? d[0]?.id ?? null);
    } catch (e) {
      setError(errorMessage(e));
    }
  }, [course.id]);
  useEffect(() => {
    void load();
  }, [load]);

  if (!decks) return error ? <Notice tone="danger">{error}</Notice> : null;
  const deck = decks.find((d) => d.id === selected) ?? null;

  async function create(event?: FormEvent) {
    event?.preventDefault();
    if (!name.trim()) return;
    const made = await api.createDeck(course.id, name).catch((e) => (setError(errorMessage(e)), null));
    if (made) {
      setName("");
      setCreating(false);
      setSelected(made.id);
      setMode("cards");
      await load();
    }
  }

  const newDeck = (
    <form className="new-deck" onSubmit={create}>
      <TextField label={t.cards.newDeck} hideLabel placeholder={t.cards.deckName} value={name} onChange={(e) => setName(e.target.value)} autoFocus={creating} required />
      <Button type="submit" variant="primary" icon="plus" disabled={!name.trim()}>
        {t.cards.create}
      </Button>
    </form>
  );

  if (decks.length === 0 && proposals.length === 0) {
    return (
      <div className="narrow ui-stack">
        {error && <Notice tone="danger">{error}</Notice>}
        <EmptyState
          illustration="karten"
          title={t.cards.emptyTitle}
          actions={
            canEdit &&
            (creating ? (
              newDeck
            ) : (
              <Button variant="primary" icon="plus" onClick={() => setCreating(true)}>
                {t.cards.createDeck}
              </Button>
            ))
          }
        >
          {t.cards.emptyText}
        </EmptyState>
        <div className="steps">
          <Card tone="petrol" padding="sm" className="step">
            <span className="step-number ui-display">1</span>
            {t.cards.step1}
          </Card>
          <Card tone="blau" padding="sm" className="step">
            <span className="step-number ui-display">2</span>
            {t.cards.step2}
          </Card>
          <Card tone="violett" padding="sm" className="step">
            <span className="step-number ui-display">3</span>
            {t.cards.step3}
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="deck-split">
      <aside className="ui-stack">
        {error && <Notice tone="danger">{error}</Notice>}
        <Card padding="sm">
          <List>
            {decks.map((d) => (
              <ListRow
                key={d.id}
                selected={d.id === selected}
                onClick={() => setSelected(d.id)}
                title={d.name}
                meta={t.cards.counts(d.cards, d.new)}
                trailing={d.due > 0 ? <Chip tone="violett" size="sm">{d.due}</Chip> : <Chip size="sm">0</Chip>}
              />
            ))}
          </List>
        </Card>
        {decks.length === 0 && <p className="quiet small">{t.cards.noDecks}</p>}
        {canEdit && newDeck}
        <p className="quiet small">{t.cards.claudeHint}</p>
      </aside>
      <section className="ui-stack">
        {proposals.length > 0 && <Proposals proposals={proposals} canEdit={canEdit} onChanged={load} />}
        {deck && (
          <>
            <SectionHeader
              title={deck.name}
              action={
                <SegmentedControl
                  label={deck.name}
                  size="sm"
                  value={mode}
                  onChange={setMode}
                  options={[
                    { value: "study", label: t.cards.study, icon: "cards" },
                    { value: "cards", label: t.cards.cards(deck.cards), icon: "list" },
                  ]}
                />
              }
            />
            {mode === "study" ? <Study key={deck.id} deck={deck} onDone={load} /> : <CardList key={deck.id} deck={deck} canEdit={canEdit} onChanged={load} />}
          </>
        )}
      </section>
    </div>
  );
}

const RATINGS = [1, 2, 3, 4] as const;
const RATING_TONE = { 1: "rot", 2: "gelb", 3: "gruen", 4: "blau" } as const;

function Study({ deck, onDone }: { deck: Deck; onDone: () => void }) {
  const [queue, setQueue] = useState<FlashCard[] | null>(null);
  const [shown, setShown] = useState(false);
  const [done, setDone] = useState(0);

  useEffect(() => {
    api.queue(deck.id).then(setQueue);
  }, [deck.id]);

  const card = queue?.[0];
  const answer = useCallback(
    async (rating: 1 | 2 | 3 | 4) => {
      if (!card) return;
      const result = await api.review(card.id, rating);
      setShown(false);
      setDone((n) => n + 1);
      // Cards still in learning come back in this session when due soon.
      const again = new Date(result.due).getTime() - Date.now() < 20 * 60_000;
      setQueue((q) => {
        const rest = (q ?? []).slice(1);
        return again ? [...rest, { ...card, due: result.due, state: result.state }] : rest;
      });
      if (queue && queue.length <= 1 && !again) onDone();
    },
    [card, queue, onDone],
  );

  useEffect(() => {
    const keys = (event: KeyboardEvent) => {
      if ((event.target as HTMLElement).closest("input, textarea, select")) return;
      if (event.key === " " && !shown) {
        event.preventDefault();
        setShown(true);
      } else if (shown && ["1", "2", "3", "4"].includes(event.key)) void answer(Number(event.key) as 1 | 2 | 3 | 4);
    };
    window.addEventListener("keydown", keys);
    return () => window.removeEventListener("keydown", keys);
  }, [shown, answer]);

  if (!queue) return null;
  if (!card)
    return (
      <EmptyState variant="plain" size="sm" illustration={done > 0 ? "stern" : "fertig"} title={done > 0 ? t.cards.doneFor(done) : t.cards.nothingDue} />
    );
  return (
    <div className="study ui-stack">
      <p className="quiet small">{t.cards.left(queue.length)}</p>
      <Card padding="lg" className="study-card">
        <div className="study-front">
          <Rich>{card.front}</Rich>
        </div>
        {shown && (
          <div className="study-back">
            <Rich>{card.back}</Rich>
          </div>
        )}
      </Card>
      {shown ? (
        <div className="ratings">
          {RATINGS.map((value) => (
            <Button key={value} variant="soft" tone={RATING_TONE[value]} onClick={() => answer(value)} aria-keyshortcuts={String(value)}>
              {t.cards.ratings[value - 1]} <span className="quiet small">{value}</span>
            </Button>
          ))}
        </div>
      ) : (
        <Button variant="primary" size="lg" icon="eye" onClick={() => setShown(true)} aria-keyshortcuts="Space">
          {t.cards.show}
        </Button>
      )}
    </div>
  );
}

function CardList({ deck, canEdit, onChanged }: { deck: Deck; canEdit: boolean; onChanged: () => void }) {
  const [cards, setCards] = useState<FlashCard[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [menu, setMenu] = useState<{ card: FlashCard; at: MenuPosition } | null>(null);
  const load = useCallback(() => api.cards(deck.id).then(setCards), [deck.id]);
  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="ui-stack">
      {canEdit && (
        <Card variant="sunken" padding="sm">
          <CardForm
            submitLabel={t.common.add}
            onSubmit={async (card) => {
              await api.addCard(deck.id, card);
              await load();
              onChanged();
            }}
          />
        </Card>
      )}
      <Card padding="sm">
        <List>
          {cards.map((card) =>
            editing === card.id ? (
              <li key={card.id} className="row-editing">
                <CardForm
                  initial={card}
                  submitLabel={t.common.save}
                  onCancel={() => setEditing(null)}
                  onSubmit={async (draft) => {
                    await api.updateCard(card.id, draft);
                    setEditing(null);
                    await load();
                  }}
                />
              </li>
            ) : (
              <ListRow
                key={card.id}
                title={<Rich>{card.front}</Rich>}
                meta={<Rich>{card.back}</Rich>}
                trailing={
                  <>
                    <Chip size="sm" tone={card.due ? "grau" : "violett"}>
                      {card.due ? formatShortDate(card.due) : t.cards.unseen}
                    </Chip>
                    {canEdit && <IconButton icon="more" size="sm" label={t.common.actionsFor(card.front.slice(0, 40))} onClick={(e) => setMenu({ card, at: menuPositionFrom(e.currentTarget) })} />}
                  </>
                }
              />
            ),
          )}
        </List>
      </Card>
      {menu && (
        <ContextMenu at={menu.at} label={t.common.actionsFor(menu.card.front.slice(0, 40))} onClose={() => setMenu(null)}>
          <MenuItem
            icon="edit"
            onSelect={() => {
              setEditing(menu.card.id);
              setMenu(null);
            }}
          >
            {t.common.edit}
          </MenuItem>
          <MenuSeparator />
          <MenuItem
            icon="trash"
            danger
            onSelect={() => {
              const id = menu.card.id;
              setMenu(null);
              void api.deleteCard(id).then(load).then(onChanged);
            }}
          >
            {t.common.delete}
          </MenuItem>
        </ContextMenu>
      )}
    </div>
  );
}

function CardForm(props: { initial?: { front: string; back: string }; submitLabel: string; onSubmit: (card: { front: string; back: string }) => Promise<void>; onCancel?: () => void }) {
  const [front, setFront] = useState(props.initial?.front ?? "");
  const [back, setBack] = useState(props.initial?.back ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="card-form"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          await props.onSubmit({ front, back });
          if (!props.initial) {
            setFront("");
            setBack("");
          }
          setError(null);
        } catch (err) {
          setError(errorMessage(err));
        } finally {
          setBusy(false);
        }
      }}
    >
      <TextArea label={t.cards.front} rows={2} value={front} onChange={(e) => setFront(e.target.value)} required />
      <TextArea label={t.cards.back} rows={2} value={back} onChange={(e) => setBack(e.target.value)} required />
      {error && <Notice tone="danger">{error}</Notice>}
      <div className="form-actions">
        {props.onCancel && <Button onClick={props.onCancel}>{t.common.cancel}</Button>}
        <Button type="submit" variant="primary" loading={busy} disabled={!front.trim() || !back.trim()}>
          {props.submitLabel}
        </Button>
      </div>
    </form>
  );
}

function Proposals({ proposals, canEdit, onChanged }: { proposals: Proposal[]; canEdit: boolean; onChanged: () => void }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const run = (operation: Promise<unknown>) => operation.then(onChanged, (e) => setError(errorMessage(e)));
  return (
    <Card as="section" tone="gelb" aria-labelledby="vorschlaege">
      <SectionHeader id="vorschlaege" title={t.cards.proposals(proposals.length)} description={!canEdit ? t.cards.proposalsReadOnly : undefined} />
      {error && <Notice tone="danger">{error}</Notice>}
      <List variant="raised" className="card-list">
        {proposals.map((p) =>
          editing === p.id ? (
            <li key={p.id} className="row-editing">
              <CardForm
                initial={p}
                submitLabel={t.cards.accept}
                onCancel={() => setEditing(null)}
                onSubmit={async (card) => {
                  await api.acceptProposal(p.id, card);
                  setEditing(null);
                  onChanged();
                }}
              />
            </li>
          ) : (
            <ListRow
              key={p.id}
              leading={<Chip size="sm" tone="gelb" icon="claude">{p.deckName}</Chip>}
              title={<Rich>{p.front}</Rich>}
              meta={<Rich>{p.back}</Rich>}
              trailing={
                <>
                  {canEdit && (
                    <>
                      <Button size="sm" variant="primary" icon="check" onClick={() => run(api.acceptProposal(p.id))}>
                        {t.cards.accept}
                      </Button>
                      <IconButton icon="edit" size="sm" label={t.common.edit} onClick={() => setEditing(p.id)} />
                    </>
                  )}
                  <IconButton icon="close" size="sm" label={t.cards.reject} onClick={() => run(api.rejectProposal(p.id))} />
                </>
              }
            />
          ),
        )}
      </List>
    </Card>
  );
}
