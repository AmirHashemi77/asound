interface FilePickerAcceptType {
  description?: string;
  accept: Record<string, string[]>;
}

interface FilePickerOptions {
  multiple?: boolean;
  types?: FilePickerAcceptType[];
}

interface DirectoryPickerOptions {
  mode?: "read" | "readwrite";
  startIn?: "desktop" | "documents" | "downloads" | "music" | "pictures" | "videos";
}

interface Window {
  showOpenFilePicker?: (options?: FilePickerOptions) => Promise<FileSystemFileHandle[]>;
  showDirectoryPicker?: (options?: DirectoryPickerOptions) => Promise<FileSystemDirectoryHandle>;
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

type PickerPermissionMode = "read" | "readwrite";
type PickerPermissionState = "granted" | "denied" | "prompt";

interface FileSystemPermissionDescriptor {
  mode?: PickerPermissionMode;
}

interface FileSystemHandlePermissionCapable {
  queryPermission?: (descriptor?: FileSystemPermissionDescriptor) => Promise<PickerPermissionState>;
  requestPermission?: (descriptor?: FileSystemPermissionDescriptor) => Promise<PickerPermissionState>;
}

declare class FileSystemFileHandle {
  kind: "file";
  name: string;
  getFile(): Promise<File>;
}

declare class FileSystemDirectoryHandle implements FileSystemHandlePermissionCapable {
  kind: "directory";
  name: string;
  values?(): AsyncIterable<FileSystemFileHandle | FileSystemDirectoryHandle>;
  entries?(): AsyncIterable<[string, FileSystemFileHandle | FileSystemDirectoryHandle]>;
  queryPermission?: (descriptor?: FileSystemPermissionDescriptor) => Promise<PickerPermissionState>;
  requestPermission?: (descriptor?: FileSystemPermissionDescriptor) => Promise<PickerPermissionState>;
}
