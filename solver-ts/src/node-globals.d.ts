// Minimal ambient declarations for the handful of Node globals cli.ts uses.
// Avoids depending on @types/node — npm installs into this Drive-synced
// project folder have been corrupting files (see README).
declare const process: {
  stdin: {
    setEncoding(encoding: string): void;
    on(event: "data", listener: (chunk: string) => void): void;
    on(event: "end", listener: () => void): void;
    on(event: "error", listener: (err: Error) => void): void;
  };
  stdout: { write(data: string): void };
  stderr: { write(data: string): void };
  exit(code: number): never;
};
