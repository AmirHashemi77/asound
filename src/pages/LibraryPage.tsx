import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { usePlayerStore } from "../store/player";
import TrackList from "../components/TrackList";
import SortSheet from "../components/SortSheet";
import type { TrackMeta } from "../db/types";

const sortOptions = [
  { value: "name-asc", label: "Name (A → Z)" },
  { value: "name-desc", label: "Name (Z → A)" },
  { value: "date-new", label: "Newest First" },
  { value: "date-old", label: "Oldest First" },
  { value: "duration-short", label: "Shortest" },
  { value: "duration-long", label: "Longest" }
];

const sortTracks = (tracks: TrackMeta[], sort: string) => {
  const list = [...tracks];
  switch (sort) {
    case "name-asc":
      return list.sort((a, b) => a.title.localeCompare(b.title));
    case "name-desc":
      return list.sort((a, b) => b.title.localeCompare(a.title));
    case "date-new":
      return list.sort((a, b) => (b.lastModified || 0) - (a.lastModified || 0));
    case "date-old":
      return list.sort((a, b) => (a.lastModified || 0) - (b.lastModified || 0));
    case "duration-short":
      return list.sort((a, b) => (a.duration || 0) - (b.duration || 0));
    case "duration-long":
      return list.sort((a, b) => (b.duration || 0) - (a.duration || 0));
    default:
      return list;
  }
};

const LibraryPage = () => {
  const tracks = usePlayerStore((s) => s.tracks);
  const currentTrackId = usePlayerStore((s) => s.currentTrackId);
  const setCurrent = usePlayerStore((s) => s.setCurrent);
  const setIsPlaying = usePlayerStore((s) => s.setIsPlaying);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState(sortOptions[0].value);
  const [sheetOpen, setSheetOpen] = useState(false);

  const filtered = useMemo(() => {
    const lowered = query.toLowerCase();
    const result = tracks.filter((track) =>
      `${track.title} ${track.artist || ""} ${track.album || ""}`.toLowerCase().includes(lowered)
    );
    return sortTracks(result, sort);
  }, [tracks, query, sort]);

  return (
    <div className="space-y-6">
      <header className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-semibold text-primary">Your Library</h1>
            <p className="text-sm text-muted">{tracks.length} tracks</p>
          </div>
          <Link
            to="/add"
            className="rounded-2xl bg-glow px-4 py-2 text-sm font-semibold text-white shadow-glow"
          >
            + Add
          </Link>
        </div>
        <div className="flex items-center gap-3">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search tracks, artists..."
            className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-primary placeholder:text-muted"
          />
          <button
            onClick={() => setSheetOpen(true)}
            className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm"
          >
            Sort
          </button>
        </div>
      </header>

      {filtered.length ? (
        <TrackList
          tracks={filtered}
          currentTrackId={currentTrackId}
          onSelect={(track) => {
            setCurrent(track.id);
            setIsPlaying(true);
          }}
        />
      ) : (
        <div className="glass rounded-2xl p-6 text-sm text-muted">
          No tracks yet. Tap Add to import music into your library.
        </div>
      )}

      <SortSheet
        open={sheetOpen}
        options={sortOptions}
        selected={sort}
        onSelect={setSort}
        onClose={() => setSheetOpen(false)}
      />
    </div>
  );
};

export default LibraryPage;
