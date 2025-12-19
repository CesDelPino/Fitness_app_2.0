import SettingsForm from "../SettingsForm";

export default function SettingsFormExample() {
  return (
    <SettingsForm
      onSave={(data) => {
        console.log("Settings saved:", data);
      }}
    />
  );
}
