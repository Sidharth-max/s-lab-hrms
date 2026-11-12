
// On phones the list (from the layout) fills the screen. With two panes, this fills the right side.
export default async function EmployeesIndex() {
  return (
    <div className="card hidden h-full min-h-60 items-center justify-center text-center fold:flex">
      <p className="muted">Choose an employee from the list to see details.</p>
    </div>
  );
}
