import CalorieAdherenceChart from "../CalorieAdherenceChart";

export default function CalorieAdherenceChartExample() {
  const mockData = [
    { date: "Nov 17", eaten: 2050, target: 2100 },
    { date: "Nov 18", eaten: 1980, target: 2100 },
    { date: "Nov 19", eaten: 2200, target: 2100 },
    { date: "Nov 20", eaten: 2080, target: 2100 },
    { date: "Nov 21", eaten: 1950, target: 2100 },
    { date: "Nov 22", eaten: 2150, target: 2100 },
    { date: "Nov 23", eaten: 1800, target: 2100 },
  ];

  return <CalorieAdherenceChart data={mockData} />;
}
