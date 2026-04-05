import { createSignal, For, Show, onCleanup, onMount } from "solid-js";
import {
  createQuery,
  createMutation,
  useQueryClient,
} from "@tanstack/solid-query";
import {
  fetchCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  type Category,
} from "../lib/api";
import { cn } from "../lib/cn";

type Props = {
  onClose: () => void;
  categoryType: "expense" | "income";
};

export default function ManageCategoriesModal(props: Props) {
  const [editingId, setEditingId] = createSignal<string | null>(null);
  const [editName, setEditName] = createSignal("");
  const [editIcon, setEditIcon] = createSignal("");
  const [addName, setAddName] = createSignal("");
  const [addIcon, setAddIcon] = createSignal("");
  const [showAdd, setShowAdd] = createSignal(false);
  const [deleteError, setDeleteError] = createSignal<string | null>(null);
  let editInputRef: HTMLInputElement | undefined;
  let addInputRef: HTMLInputElement | undefined;
  const queryClient = useQueryClient();

  const categoriesQuery = createQuery(() => ({
    queryKey: ["categories"],
    queryFn: fetchCategories,
  }));

  const filtered = () =>
    (categoriesQuery.data ?? []).filter((c) => c.type === props.categoryType);

  onMount(() => {
    document.body.style.overflow = "hidden";
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (editingId()) {
          setEditingId(null);
        } else if (showAdd()) {
          setShowAdd(false);
        } else {
          props.onClose();
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    onCleanup(() => window.removeEventListener("keydown", onKeyDown));
  });

  onCleanup(() => {
    document.body.style.overflow = "";
  });

  const createMut = createMutation(() => ({
    mutationFn: createCategory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      setAddName("");
      setAddIcon("");
      setShowAdd(false);
    },
  }));

  const updateMut = createMutation(() => ({
    mutationFn: (vars: { id: string; data: { name: string; icon: string } }) =>
      updateCategory(vars.id, vars.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      setEditingId(null);
    },
  }));

  const deleteMut = createMutation(() => ({
    mutationFn: deleteCategory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      setDeleteError(null);
    },
    onError: (err: Error) => {
      setDeleteError(err.message);
    },
  }));

  const startEdit = (cat: Category) => {
    setEditingId(cat.id);
    setEditName(cat.name);
    setEditIcon(cat.icon);
    setDeleteError(null);
    setTimeout(() => editInputRef?.focus(), 0);
  };

  const handleSave = () => {
    const id = editingId();
    if (!id || !editName().trim() || !editIcon().trim()) return;
    updateMut.mutate({
      id,
      data: { name: editName().trim(), icon: editIcon().trim() },
    });
  };

  const handleAdd = () => {
    if (!addName().trim() || !addIcon().trim()) return;
    createMut.mutate({ name: addName().trim(), icon: addIcon().trim(), type: props.categoryType });
  };

  const handleDelete = (id: string) => {
    if (!confirm("Remove this category? This cannot be undone.")) return;
    setDeleteError(null);
    deleteMut.mutate(id);
  };

  return (
    <>
      <div
        class="fixed inset-0 bg-black/60 z-40 backdrop-blur-sm"
        onClick={props.onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Manage categories"
        class="fixed inset-x-0 bottom-0 z-50 bg-sheet-bg rounded-t-3xl px-6 pt-4 pb-10 sheet-enter max-w-md mx-auto max-h-[80vh] overflow-y-auto"
      >
        <div class="w-10 h-1 bg-white/20 rounded-full mx-auto mb-6" />
        <h2 class="text-white font-semibold text-xl text-center mb-6">
          Manage {props.categoryType === "income" ? "Income" : "Expense"} Categories
        </h2>

        <Show when={deleteError()}>
          <p class="text-red-400 text-sm text-center mb-4">{deleteError()}</p>
        </Show>

        <div class="space-y-2">
          <For each={filtered()}>
            {(cat) => (
              <Show
                when={editingId() === cat.id}
                fallback={
                  <div class="flex items-center gap-3 bg-white/5 rounded-xl px-4 py-3">
                    <span class="text-lg flex-shrink-0">{cat.icon}</span>
                    <p class="flex-1 min-w-0 text-sm font-medium text-white truncate">
                      {cat.name}
                    </p>
                    <button
                      type="button"
                      onClick={() => startEdit(cat)}
                      class="p-1.5 text-gray-500 hover:text-white transition-colors"
                      aria-label={`Edit ${cat.name}`}
                    >
                      <svg
                        class="w-4 h-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        stroke-width="2"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                        />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(cat.id)}
                      disabled={deleteMut.isPending}
                      class="p-1.5 text-gray-500 hover:text-red-400 transition-colors disabled:opacity-50"
                      aria-label={`Delete ${cat.name}`}
                    >
                      <svg
                        class="w-4 h-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        stroke-width="2"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    </button>
                  </div>
                }
              >
                {/* Edit mode */}
                <div class="bg-white/5 rounded-xl px-4 py-3 space-y-3">
                  <div class="flex gap-2">
                    <input
                      type="text"
                      value={editIcon()}
                      onInput={(e) => setEditIcon(e.currentTarget.value)}
                      class="w-14 bg-white/5 rounded-lg px-3 py-2 text-white text-sm text-center outline-none focus:ring-1 focus:ring-purple-500"
                      placeholder="🔖"
                    />
                    <input
                      ref={editInputRef}
                      type="text"
                      value={editName()}
                      onInput={(e) => setEditName(e.currentTarget.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSave();
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      class="flex-1 bg-white/5 rounded-lg px-3 py-2 text-white text-sm placeholder:text-gray-600 outline-none focus:ring-1 focus:ring-purple-500"
                      placeholder="Category name"
                    />
                  </div>
                  <Show when={updateMut.isError}>
                    <p class="text-red-400 text-xs">
                      Failed to update category.
                    </p>
                  </Show>
                  <div class="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      class="flex-1 py-2 rounded-lg bg-white/5 text-gray-400 text-sm font-medium hover:bg-white/10 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSave}
                      disabled={updateMut.isPending}
                      class="flex-1 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
                    >
                      {updateMut.isPending ? "Saving..." : "Save"}
                    </button>
                  </div>
                </div>
              </Show>
            )}
          </For>
        </div>

        {/* Add new category */}
        <Show
          when={showAdd()}
          fallback={
            <button
              type="button"
              onClick={() => {
                setShowAdd(true);
                setTimeout(() => addInputRef?.focus(), 0);
              }}
              class="w-full mt-3 py-3 rounded-xl border border-dashed border-white/10 text-gray-500 text-sm font-medium hover:border-white/20 hover:text-gray-400 transition-colors"
            >
              + Add Category
            </button>
          }
        >
          <div class="bg-white/5 rounded-xl px-4 py-3 mt-3 space-y-3">
            <div class="flex gap-2">
              <input
                type="text"
                value={addIcon()}
                onInput={(e) => setAddIcon(e.currentTarget.value)}
                class="w-14 bg-white/5 rounded-lg px-3 py-2 text-white text-sm text-center outline-none focus:ring-1 focus:ring-purple-500"
                placeholder="🔖"
              />
              <input
                ref={addInputRef}
                type="text"
                value={addName()}
                onInput={(e) => setAddName(e.currentTarget.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAdd();
                  if (e.key === "Escape") setShowAdd(false);
                }}
                class="flex-1 bg-white/5 rounded-lg px-3 py-2 text-white text-sm placeholder:text-gray-600 outline-none focus:ring-1 focus:ring-purple-500"
                placeholder="Category name"
              />
            </div>
            <Show when={createMut.isError}>
              <p class="text-red-400 text-xs">Failed to create category.</p>
            </Show>
            <div class="flex gap-2">
              <button
                type="button"
                onClick={() => setShowAdd(false)}
                class="flex-1 py-2 rounded-lg bg-white/5 text-gray-400 text-sm font-medium hover:bg-white/10 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAdd}
                disabled={createMut.isPending}
                class="flex-1 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
              >
                {createMut.isPending ? "Adding..." : "Add"}
              </button>
            </div>
          </div>
        </Show>

        <button
          type="button"
          onClick={props.onClose}
          class="w-full mt-6 py-3 rounded-xl bg-white/5 text-gray-400 text-sm font-medium hover:bg-white/10 transition-colors"
        >
          Close
        </button>
      </div>
    </>
  );
}
