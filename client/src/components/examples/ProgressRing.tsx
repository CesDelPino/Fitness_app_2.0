import ProgressRing from "../ProgressRing";

export default function ProgressRingExample() {
  return (
    <ProgressRing
      eaten={1450}
      target={2100}
      protein={85}
      carbs={150}
      fat={45}
    />
  );
}
