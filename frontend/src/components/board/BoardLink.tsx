import { Link, type LinkProps } from "react-router-dom";
import { useBoard } from "../../hooks/useBoard";

/** A Link whose `to` ("/players/kerem") is resolved inside the current board. */
export function BoardLink({ to, ...props }: Omit<LinkProps, "to"> & { to: string }) {
  const { path } = useBoard();
  return <Link to={path(to)} {...props} />;
}
