import QuickActions from "../QuickActions";

export default function QuickActionsExample() {
  return (
    <QuickActions
      onCameraClick={() => console.log("Camera clicked")}
      onTextClick={() => console.log("Text clicked")}
    />
  );
}
