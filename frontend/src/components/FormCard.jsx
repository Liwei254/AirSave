import Card from "./Card.jsx";

export default function FormCard({ className = "", children }) {
  return (
    <Card className={["fin-form-main", className].filter(Boolean).join(" ")} hover={false}>
      {children}
    </Card>
  );
}
