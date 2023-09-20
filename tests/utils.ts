import { expect, assert } from "chai";
import { Program } from "@project-serum/anchor";

let constraints = {
  2000: "ConstraintMut",
  2001: "ConstraintHasOne",
  2002: "ConstraintSigner",
  2003: "ConstraintRaw",
  2004: "ConstraintOwner",
  2005: "ConstraintRentExempt",
  2006: "ConstraintSeeds",
  2007: "ConstraintExecutable",
  2008: "ConstraintState",
  2009: "ConstraintAssociated",
  2010: "ConstraintAssociatedInit",
  2011: "ConstraintClose",
  2012: "ConstraintAddress",
  2013: "ConstraintZero",
  2014: "ConstraintTokenMint",
  2015: "ConstraintTokenOwner",
  2016: "ConstraintMintMintAuthority",
  2017: "ConstraintMintFreezeAuthority",
  2018: "ConstraintMintDecimals",
  2019: "ConstraintSpace",
  2020: "ConstraintAccountIsNone",
  2021: "ConstraintTokenTokenProgram",
  2022: "ConstraintMintTokenProgram",
  2023: "ConstraintAssociatedTokenTokenProgram",
};

export const expectError = (
  program: Program,
  expectedError: string,
  message: string
): [() => void, (e: any) => void] => {
  return [
    () => assert.fail(message),
    (e) => {
      /* console.log(e); */
      assert(
        e.error.errorCode != undefined,
        "problem retrieving program error code"
      );
      //for (let idlError of program.idl.errors) {
      //  if (idlError.code == e.code) {
      //    assert.equal(idlError.name, expectedError);
      //    return;
      //  }
      //}
      assert.equal(
        e.error.errorCode.code,
        expectedError,
        `the program threw for a reason that we didn't expect. error : ${e}`
      );
      /* assert.fail("error doesn't match idl"); */
      /* console.log(program.idl.errors); */
      /* assert( */
      /*   e["error"] != undefined, */
      /*   `the program threw for a reason that we didn't expect. error: ${e}` */
      /* ); */
      /* assert.equal(e.error.errorCode.code, expectedErrorCode); */
    },
  ];
};
