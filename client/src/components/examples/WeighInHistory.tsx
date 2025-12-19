import WeighInHistory from "../WeighInHistory";

export default function WeighInHistoryExample() {
  const mockRecords = [
    {
      id: "1",
      date: "Nov 23, 2025",
      weight: 185.2,
      change: -0.6,
      notes: "Feeling great after morning workout",
    },
    {
      id: "2",
      date: "Nov 22, 2025",
      weight: 185.8,
      change: -0.3,
    },
    {
      id: "3",
      date: "Nov 21, 2025",
      weight: 186.1,
      change: 0.6,
    },
  ];

  return <WeighInHistory records={mockRecords} />;
}
