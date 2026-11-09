import props from "../generated/props.json";

interface Prop {
  name: string;
  type: string;
  required: boolean;
  default: string | null;
  description: string;
}

const all = props as Record<string, { description: string; props: Prop[] }>;

/** The props of a building block, read from its TypeScript types at build time. */
export function PropsTable({ of }: { of: string }) {
  const component = all[of];
  if (!component) return <p className="doc-props-none">Keine Props gefunden für {of}.</p>;
  if (component.props.length === 0) return <p className="doc-props-none">{of} hat keine eigenen Props.</p>;
  return (
    <table>
      <thead>
        <tr>
          <th>Prop</th>
          <th>Typ</th>
          <th>Standard</th>
          <th>Bedeutung</th>
        </tr>
      </thead>
      <tbody>
        {component.props.map((prop) => (
          <tr key={prop.name}>
            <td>
              <code>{prop.name}</code>
              {prop.required && <span title="Pflicht"> *</span>}
            </td>
            <td>
              <code>{prop.type}</code>
            </td>
            <td>{prop.default !== null ? <code>{prop.default}</code> : "–"}</td>
            <td style={{ whiteSpace: "pre-line" }}>{prop.description}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
