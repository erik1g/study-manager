/** Options for choosing files, as for `<input type="file">`. */
export interface PickFilesOptions {
  accept?: string;
  multiple?: boolean;
}

/**
 * Opens the system's file picker from a button press and gives the chosen
 * files (none when cancelled). For a place to drop files use `FileDrop`.
 */
export function pickFiles({ accept, multiple = true }: PickFilesOptions = {}): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = multiple;
    if (accept) input.accept = accept;
    input.style.display = "none";
    input.addEventListener("change", () => {
      resolve(Array.from(input.files ?? []));
      input.remove();
    });
    input.addEventListener("cancel", () => {
      resolve([]);
      input.remove();
    });
    document.body.append(input);
    input.click();
  });
}
