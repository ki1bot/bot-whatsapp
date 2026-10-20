const DRIVE_FOLDER_URL =
  "https://drive.google.com/drive/folders/1TCMX6rSBgCBre7L-qev_qRzONYsjkJ_p";

export function handleMateriCommand(input) {
  const command = input.trim().toLowerCase().replace(/\s+/g, " ");

  if (command === "/materi") {
    return [
      "*MATERI KULIAH SEMESTER 5*",
      "",
      "Halo! Ini folder Google Drive yang berisi materi kuliah yang sudah disiapkan.",
      "",
      DRIVE_FOLDER_URL,
      "",
      "Silakan buka tautan tersebut untuk melihat materi yang tersedia.",
      "",
      "Semangat belajarnya!",
    ].join("\n");
  }

  if (command.startsWith("/materi ")) {
    return [
      "Perintah materi belum sesuai.",
      "",
      "Untuk melihat tautan Google Drive, cukup ketik:",
      "/materi",
    ].join("\n");
  }

  return null;
}
