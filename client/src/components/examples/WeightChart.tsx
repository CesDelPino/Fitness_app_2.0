import WeightChart from "../WeightChart";

export default function WeightChartExample() {
  const mockData = [
    { date: "Nov 23", weight: 185.2 },
    { date: "Nov 22", weight: 185.8 },
    { date: "Nov 21", weight: 186.1 },
    { date: "Nov 20", weight: 185.5 },
    { date: "Nov 19", weight: 186.3 },
    { date: "Nov 18", weight: 186.0 },
    { date: "Nov 17", weight: 186.5 },
  ];

  return <WeightChart data={mockData} />;
}
