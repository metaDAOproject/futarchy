import { expect, assert } from "chai";

export const expectError = (
  expectedErrorCode: string,
  message: string
): [() => void, (e: any) => void] => {
  return [
    () => assert.fail(message),
    (e) => {
      assert(
        e["error"] != undefined,
        `the program threw for a reason that we didn't expect. error: ${e}`
      );
      assert.equal(e.error.errorCode.code, expectedErrorCode);
    },
  ];
};
