import { RegisterForm } from "@/components/register-form";

/** Alumni registration: any email, then a claim an admin verifies (docs/PRD §4.5). */
export default function AlumniRegisterPage() {
  return <RegisterForm kind="alumni" />;
}
