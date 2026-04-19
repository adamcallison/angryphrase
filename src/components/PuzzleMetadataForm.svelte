<script lang="ts">
  let {
    title,
    author,
    onTitleChange,
    onAuthorChange,
  }: {
    title: string;
    author: string;
    onTitleChange: (newTitle: string) => void;
    onAuthorChange: (newAuthor: string) => void;
  } = $props();
</script>

<div class="flex flex-col gap-3">
  <div class="flex flex-col gap-1">
    <label for="puzzle-title" class="text-sm font-medium text-gray-700"
      >Title</label
    >
    <input
      id="puzzle-title"
      type="text"
      class="border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      value={title}
      oninput={(e) => onTitleChange((e.target as HTMLInputElement).value)}
    />
  </div>
  <div class="flex flex-col gap-1">
    <label for="puzzle-author" class="text-sm font-medium text-gray-700"
      >Author</label
    >
    <input
      id="puzzle-author"
      type="text"
      class="border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      value={author}
      oninput={(e) => onAuthorChange((e.target as HTMLInputElement).value)}
    />
  </div>
</div>