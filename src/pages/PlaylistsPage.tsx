import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { usePlayerStore } from "../store/player";
import TrackPickerSheet from "../components/TrackPickerSheet";

const PlaylistsPage = () => {
  const tracks = usePlayerStore((s) => s.tracks);
  const playlists = usePlayerStore((s) => s.playlists);
  const createPlaylist = usePlayerStore((s) => s.createPlaylist);
  const updatePlaylist = usePlayerStore((s) => s.updatePlaylist);
  const deletePlaylist = usePlayerStore((s) => s.deletePlaylist);
  const setCurrent = usePlayerStore((s) => s.setCurrent);
  const setIsPlaying = usePlayerStore((s) => s.setIsPlaying);

  const [name, setName] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(playlists[0]?.id || null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const selectedPlaylist = playlists.find((item) => item.id === selectedId) || null;

  const trackMap = useMemo(() => new Map(tracks.map((t) => [t.id, t])), [tracks]);

  const create = async () => {
    if (!name.trim()) return;
    const playlist = await createPlaylist(name.trim());
    setSelectedId(playlist.id);
    setName("");
  };

  const toggleTrack = async (id: string) => {
    if (!selectedPlaylist) return;
    const exists = selectedPlaylist.trackIds.includes(id);
    const nextIds = exists
      ? selectedPlaylist.trackIds.filter((trackId) => trackId !== id)
      : [...selectedPlaylist.trackIds, id];
    await updatePlaylist({ ...selectedPlaylist, trackIds: nextIds });
  };

  const moveTrack = async (index: number, direction: -1 | 1) => {
    if (!selectedPlaylist) return;
    const next = [...selectedPlaylist.trackIds];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    await updatePlaylist({ ...selectedPlaylist, trackIds: next });
  };

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <h1 className="font-display text-2xl font-semibold text-primary">Playlists</h1>
        <div className="flex gap-2">
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="New playlist name"
            className="flex-1 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm"
          />
          <button
            onClick={create}
            className="rounded-2xl bg-glow px-4 py-3 text-sm font-semibold text-white"
          >
            Create
          </button>
        </div>
      </header>

      <div className="space-y-3">
        {playlists.length === 0 && (
          <div className="glass rounded-2xl p-6 text-sm text-muted">
            Create your first playlist to start curating.
          </div>
        )}
        {playlists.map((playlist) => (
          <button
            key={playlist.id}
            onClick={() => setSelectedId(playlist.id)}
            className={`flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left ${
              playlist.id === selectedId ? "bg-white/10 text-primary" : "bg-white/5 text-muted"
            }`}
          >
            <div>
              <p className="font-semibold">{playlist.name}</p>
              <p className="text-xs text-muted">{playlist.trackIds.length} tracks</p>
            </div>
            {playlist.id === selectedId && (
              <button
                onClick={(event) => {
                  event.stopPropagation();
                  deletePlaylist(playlist.id);
                  setSelectedId(null);
                }}
                className="text-xs text-red-300"
              >
                Delete
              </button>
            )}
          </button>
        ))}
      </div>

      {selectedPlaylist && (
        <div className="glass space-y-4 rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-lg font-semibold text-primary">{selectedPlaylist.name}</h2>
              <p className="text-xs text-muted">Arrange tracks with arrows</p>
            </div>
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => setPickerOpen(true)}
              className="rounded-2xl bg-white/10 px-4 py-2 text-sm"
            >
              Add Tracks
            </motion.button>
          </div>
          <div className="space-y-2">
            {selectedPlaylist.trackIds.map((id, index) => {
              const track = trackMap.get(id);
              if (!track) return null;
              return (
                <div
                  key={id}
                  className="flex items-center justify-between rounded-2xl bg-white/5 px-4 py-3"
                >
                  <div>
                    <p className="font-semibold text-primary">{track.title}</p>
                    <p className="text-xs text-muted">{track.artist || "Unknown Artist"}</p>
                  </div>
                  <div className="flex gap-2 text-xs">
                    <button
                      onClick={() => {
                        setCurrent(track.id);
                        setIsPlaying(true);
                      }}
                      className="rounded-full bg-white/10 px-2 py-1"
                    >
                      Play
                    </button>
                    <button
                      onClick={() => moveTrack(index, -1)}
                      className="rounded-full bg-white/10 px-2 py-1"
                    >
                      ↑
                    </button>
                    <button
                      onClick={() => moveTrack(index, 1)}
                      className="rounded-full bg-white/10 px-2 py-1"
                    >
                      ↓
                    </button>
                    <button
                      onClick={() => toggleTrack(id)}
                      className="rounded-full bg-white/10 px-2 py-1 text-red-300"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              );
            })}
            {selectedPlaylist.trackIds.length === 0 && (
              <p className="text-sm text-muted">No tracks yet. Add from your library.</p>
            )}
          </div>
        </div>
      )}

      <TrackPickerSheet
        open={pickerOpen}
        tracks={tracks}
        selectedIds={selectedPlaylist?.trackIds || []}
        onToggle={toggleTrack}
        onClose={() => setPickerOpen(false)}
      />
    </div>
  );
};

export default PlaylistsPage;
