import { Buffer } from "buffer";
import { Address, contract, rpc } from '@stellar/stellar-sdk';
export * from '@stellar/stellar-sdk'
export { contract, rpc } from '@stellar/stellar-sdk'

if (typeof window !== 'undefined') {
  //@ts-ignore Buffer exists
  window.Buffer = window.Buffer || Buffer;
}


export const networks = {
  testnet: {
    networkPassphrase: "Test SDF Network ; September 2015",
    contractId: "CAWLDMLCOUPD4OSXQF3WHMTCXW6MS3QNYNFFCTXT2J3VLDH7AUECDDB3",
  }
} as const

export const PassportError = {
  1: {message:"AlreadyRegistered"},
  2: {message:"NotRegistered"},
  3: {message:"Unauthorized"},
  4: {message:"InvalidPoints"},
  5: {message:"Overflow"},
  6: {message:"TooManyVerifications"}
}

/**
 * Tipos de verificación soportados.
 * `Custom(Symbol)` permite extensiones (p.ej. "over18_cr", "kyc_sumsub").
 */
export type VerificationType = {tag: "Over18", values: void} | {tag: "Twitter", values: void} | {tag: "GitHub", values: void} | {tag: "BrightID", values: void} | {tag: "WorldID", values: void} | {tag: "Custom", values: readonly [string]};


/**
 * Una verificación concreta aplicada a un usuario.
 */
export interface Verification {
  issuer: string;
  points: contract.i32;
  timestamp: contract.u64;
  vtype: VerificationType;
}


/**
 * Datos agregados del usuario.
 * `name` / `surnames` son opcionales a nivel de producto (pueden quedar vacíos para privacidad).
 */
export interface User {
  name: string;
  score: contract.i32;
  surnames: string;
  ver_count: contract.u32;
  wallet: string;
}

/**
 * Claves de almacenamiento del contrato.
 */
export type DataKey = {tag: "User", values: readonly [string]} | {tag: "Verifications", values: readonly [string]};

/**
 * Eventos de negocio (útiles para indexadores y backends).
 */
export type Event = {tag: "UserRegistered", values: readonly [string]} | {tag: "VerificationUpserted", values: readonly [string, VerificationType, contract.i32, contract.i32, contract.i32]};

export interface Client {
  /**
   * Construct and simulate a version transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  version: (options?: {
    /**
     * The fee to pay for the transaction. Default: BASE_FEE
     */
    fee?: number;

    /**
     * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
     */
    timeoutInSeconds?: number;

    /**
     * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
     */
    simulate?: boolean;
  }) => Promise<contract.AssembledTransaction<contract.u32>>

  /**
   * Construct and simulate a register transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  register: ({wallet, name, surnames}: {wallet: string, name: string, surnames: string}, options?: {
    /**
     * The fee to pay for the transaction. Default: BASE_FEE
     */
    fee?: number;

    /**
     * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
     */
    timeoutInSeconds?: number;

    /**
     * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
     */
    simulate?: boolean;
  }) => Promise<contract.AssembledTransaction<null>>

  /**
   * Construct and simulate a get_score transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_score: ({wallet}: {wallet: string}, options?: {
    /**
     * The fee to pay for the transaction. Default: BASE_FEE
     */
    fee?: number;

    /**
     * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
     */
    timeoutInSeconds?: number;

    /**
     * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
     */
    simulate?: boolean;
  }) => Promise<contract.AssembledTransaction<contract.i32>>

  /**
   * Construct and simulate a get_verifications transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_verifications: ({wallet}: {wallet: string}, options?: {
    /**
     * The fee to pay for the transaction. Default: BASE_FEE
     */
    fee?: number;

    /**
     * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
     */
    timeoutInSeconds?: number;

    /**
     * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
     */
    simulate?: boolean;
  }) => Promise<contract.AssembledTransaction<Array<Verification>>>

  /**
   * Construct and simulate a upsert_verification transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  upsert_verification: ({wallet, vtype, points}: {wallet: string, vtype: VerificationType, points: contract.i32}, options?: {
    /**
     * The fee to pay for the transaction. Default: BASE_FEE
     */
    fee?: number;

    /**
     * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
     */
    timeoutInSeconds?: number;

    /**
     * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
     */
    simulate?: boolean;
  }) => Promise<contract.AssembledTransaction<contract.i32>>

  /**
   * Construct and simulate a update_profile transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  update_profile: ({wallet, name, surnames}: {wallet: string, name: string, surnames: string}, options?: {
    /**
     * The fee to pay for the transaction. Default: BASE_FEE
     */
    fee?: number;

    /**
     * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
     */
    timeoutInSeconds?: number;

    /**
     * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
     */
    simulate?: boolean;
  }) => Promise<contract.AssembledTransaction<null>>

}
export class Client extends contract.Client {
  static async deploy<T = Client>(
    /** Options for initializing a Client as well as for calling a method, with extras specific to deploying. */
    options: contract.MethodOptions &
      Omit<contract.ClientOptions, "contractId"> & {
        /** The hash of the Wasm blob, which must already be installed on-chain. */
        wasmHash: Buffer | string;
        /** Salt used to generate the contract's ID. Passed through to {@link Operation.createCustomContract}. Default: random. */
        salt?: Buffer | Uint8Array;
        /** The format used to decode `wasmHash`, if it's provided as a string. */
        format?: "hex" | "base64";
      }
  ): Promise<contract.AssembledTransaction<T>> {
    return contract.Client.deploy(null, options)
  }
  constructor(public readonly options: contract.ClientOptions) {
    super(
      new contract.Spec([ "AAAABAAAAAAAAAAAAAAADVBhc3Nwb3J0RXJyb3IAAAAAAAAGAAAAAAAAABFBbHJlYWR5UmVnaXN0ZXJlZAAAAAAAAAEAAAAAAAAADU5vdFJlZ2lzdGVyZWQAAAAAAAACAAAAAAAAAAxVbmF1dGhvcml6ZWQAAAADAAAAAAAAAA1JbnZhbGlkUG9pbnRzAAAAAAAABAAAAAAAAAAIT3ZlcmZsb3cAAAAFAAAAAAAAABRUb29NYW55VmVyaWZpY2F0aW9ucwAAAAY=",
        "AAAAAgAAAGpUaXBvcyBkZSB2ZXJpZmljYWNpw7NuIHNvcG9ydGFkb3MuCmBDdXN0b20oU3ltYm9sKWAgcGVybWl0ZSBleHRlbnNpb25lcyAocC5lai4gIm92ZXIxOF9jciIsICJreWNfc3Vtc3ViIikuAAAAAAAAAAAAEFZlcmlmaWNhdGlvblR5cGUAAAAGAAAAAAAAAAAAAAAGT3ZlcjE4AAAAAAAAAAAAAAAAAAdUd2l0dGVyAAAAAAAAAAAAAAAABkdpdEh1YgAAAAAAAAAAAAAAAAAIQnJpZ2h0SUQAAAAAAAAAAAAAAAdXb3JsZElEAAAAAAEAAAAAAAAABkN1c3RvbQAAAAAAAQAAABE=",
        "AAAAAQAAADFVbmEgdmVyaWZpY2FjacOzbiBjb25jcmV0YSBhcGxpY2FkYSBhIHVuIHVzdWFyaW8uAAAAAAAAAAAAAAxWZXJpZmljYXRpb24AAAAEAAAAAAAAAAZpc3N1ZXIAAAAAABMAAAAAAAAABnBvaW50cwAAAAAABQAAAAAAAAAJdGltZXN0YW1wAAAAAAAABgAAAAAAAAAFdnR5cGUAAAAAAAfQAAAAEFZlcmlmaWNhdGlvblR5cGU=",
        "AAAAAQAAAHxEYXRvcyBhZ3JlZ2Fkb3MgZGVsIHVzdWFyaW8uCmBuYW1lYCAvIGBzdXJuYW1lc2Agc29uIG9wY2lvbmFsZXMgYSBuaXZlbCBkZSBwcm9kdWN0byAocHVlZGVuIHF1ZWRhciB2YWPDrW9zIHBhcmEgcHJpdmFjaWRhZCkuAAAAAAAAAARVc2VyAAAABQAAAAAAAAAEbmFtZQAAABAAAAAAAAAABXNjb3JlAAAAAAAABQAAAAAAAAAIc3VybmFtZXMAAAAQAAAAAAAAAAl2ZXJfY291bnQAAAAAAAAEAAAAAAAAAAZ3YWxsZXQAAAAAABM=",
        "AAAAAgAAACZDbGF2ZXMgZGUgYWxtYWNlbmFtaWVudG8gZGVsIGNvbnRyYXRvLgAAAAAAAAAAAAdEYXRhS2V5AAAAAAIAAAABAAAAAAAAAARVc2VyAAAAAQAAABMAAAABAAAAAAAAAA1WZXJpZmljYXRpb25zAAAAAAAAAQAAABM=",
        "AAAAAgAAADlFdmVudG9zIGRlIG5lZ29jaW8gKMO6dGlsZXMgcGFyYSBpbmRleGFkb3JlcyB5IGJhY2tlbmRzKS4AAAAAAAAAAAAABUV2ZW50AAAAAAAAAgAAAAEAAAAAAAAADlVzZXJSZWdpc3RlcmVkAAAAAAABAAAAEwAAAAEAAAAAAAAAFFZlcmlmaWNhdGlvblVwc2VydGVkAAAABQAAABMAAAfQAAAAEFZlcmlmaWNhdGlvblR5cGUAAAAFAAAABQAAAAU=",
        "AAAAAAAAAAAAAAAHdmVyc2lvbgAAAAAAAAAAAQAAAAQ=",
        "AAAAAAAAAAAAAAAIcmVnaXN0ZXIAAAADAAAAAAAAAAZ3YWxsZXQAAAAAABMAAAAAAAAABG5hbWUAAAAQAAAAAAAAAAhzdXJuYW1lcwAAABAAAAAA",
        "AAAAAAAAAAAAAAAJZ2V0X3Njb3JlAAAAAAAAAQAAAAAAAAAGd2FsbGV0AAAAAAATAAAAAQAAAAU=",
        "AAAAAAAAAAAAAAARZ2V0X3ZlcmlmaWNhdGlvbnMAAAAAAAABAAAAAAAAAAZ3YWxsZXQAAAAAABMAAAABAAAD6gAAB9AAAAAMVmVyaWZpY2F0aW9u",
        "AAAAAAAAAAAAAAATdXBzZXJ0X3ZlcmlmaWNhdGlvbgAAAAADAAAAAAAAAAZ3YWxsZXQAAAAAABMAAAAAAAAABXZ0eXBlAAAAAAAH0AAAABBWZXJpZmljYXRpb25UeXBlAAAAAAAAAAZwb2ludHMAAAAAAAUAAAABAAAABQ==",
        "AAAAAAAAAAAAAAAOdXBkYXRlX3Byb2ZpbGUAAAAAAAMAAAAAAAAABndhbGxldAAAAAAAEwAAAAAAAAAEbmFtZQAAABAAAAAAAAAACHN1cm5hbWVzAAAAEAAAAAA=" ]),
      options
    )
  }
  // Note: fromJSON methods removed due to compatibility issues
  // These can be added back when the correct method names are identified
}