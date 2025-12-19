import WeighInForm from "../WeighInForm";

export default function WeighInFormExample() {
  return (
    <WeighInForm
      currentWeight={185.2}
      onSubmit={(weight, notes) => {
        console.log("Weight submitted:", weight, notes);
      }}
    />
  );
}
