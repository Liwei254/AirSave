import { afterEach, beforeEach, jest } from "@jest/globals";

let consoleInfoSpy;

jest.setTimeout(120000);

beforeEach(() => {
  consoleInfoSpy = jest.spyOn(console, "info").mockImplementation(() => {});
});

afterEach(() => {
  consoleInfoSpy?.mockRestore();
});
