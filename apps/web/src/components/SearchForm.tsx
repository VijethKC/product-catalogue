import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";

export function SearchForm() {
  const [value, setValue] = useState("");
  const [hint, setHint] = useState<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const query = new URLSearchParams(location.search).get("q") ?? "";
    setValue(query);
    setHint(null);
  }, [location.search]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = value.trim();

    if (query === "") {
      setHint(null);
      navigate("/");
      return;
    }

    if (query.length < 2) {
      setHint("Enter at least 2 characters");
      return;
    }

    setHint(null);
    navigate(`/search?q=${encodeURIComponent(query)}`);
  }

  return (
    <form
      role="search"
      onSubmit={handleSubmit}
      className="flex w-full flex-wrap items-center gap-2 sm:w-auto"
    >
      <label htmlFor="catalogue-search" className="sr-only">
        Search products
      </label>
      <input
        id="catalogue-search"
        type="search"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Search products"
        aria-invalid={hint === null ? undefined : true}
        aria-describedby={hint === null ? undefined : "search-hint"}
        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 sm:w-64"
      />
      <button
        type="submit"
        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
      >
        Search
      </button>
      {hint !== null && (
        <p id="search-hint" className="w-full text-xs text-red-600">
          {hint}
        </p>
      )}
    </form>
  );
}
