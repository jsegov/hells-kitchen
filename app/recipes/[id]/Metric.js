/**
 * @param {{ label: string, value: string | number }} props
 */
export default function Metric({ label, value }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
