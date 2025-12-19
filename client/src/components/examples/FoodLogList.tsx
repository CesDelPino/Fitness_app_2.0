import FoodLogList from "../FoodLogList";
import { useState } from "react";

export default function FoodLogListExample() {
  const [logs, setLogs] = useState([
    {
      id: "1",
      time: "8:30 AM",
      foodName: "Scrambled Eggs with Toast",
      calories: 350,
      protein: 24,
      carbs: 28,
      fat: 15,
    },
    {
      id: "2",
      time: "12:45 PM",
      foodName: "Grilled Chicken Salad",
      calories: 450,
      protein: 42,
      carbs: 25,
      fat: 18,
    },
    {
      id: "3",
      time: "3:15 PM",
      foodName: "Protein Shake",
      calories: 280,
      protein: 30,
      carbs: 20,
      fat: 8,
    },
  ]);

  const handleDelete = (id: string) => {
    console.log("Delete log:", id);
    setLogs(logs.filter((log) => log.id !== id));
  };

  return <FoodLogList logs={logs} onDelete={handleDelete} />;
}
