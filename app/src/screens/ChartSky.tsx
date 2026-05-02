import { useParams } from "react-router-dom";
import { Placeholder } from "../components/Placeholder";

export default function ChartSky() {
  const { id } = useParams();
  return <Placeholder name="Chart Sky" hint={`chart ${id ?? "?"} — the hero scene`} />;
}
