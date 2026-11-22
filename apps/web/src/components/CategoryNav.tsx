import { Link, useLocation } from "react-router-dom";
import { useCategories } from "../hooks/useCatalogue";

function linkClass(active: boolean): string {
  return [
    "whitespace-nowrap border-b-2 pb-1 capitalize transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2",
    active
      ? "border-indigo-600 font-medium text-indigo-600"
      : "border-transparent text-slate-600 hover:text-slate-900",
  ].join(" ");
}

export function CategoryNav() {
  const { data } = useCategories();
  const { pathname } = useLocation();
  const activeCategory = pathname.startsWith("/categories/")
    ? decodeURIComponent(pathname.slice("/categories/".length))
    : null;

  return (
    <nav
      aria-label="Categories"
      className="mt-3 flex gap-4 overflow-x-auto pb-1 text-sm"
    >
      <Link
        to="/"
        aria-current={pathname === "/" ? "page" : undefined}
        className={linkClass(pathname === "/")}
      >
        All
      </Link>
      {data?.categories.map((category) => {
        const active =
          activeCategory?.toLowerCase() === category.toLowerCase();

        return (
          <Link
            key={category}
            to={`/categories/${encodeURIComponent(category)}`}
            aria-current={active ? "page" : undefined}
            className={linkClass(active)}
          >
            {category}
          </Link>
        );
      })}
    </nav>
  );
}
