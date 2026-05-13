export type AdapterResult<T> = {
  success: boolean;
  data: T;
  verifiedAt: string;
  source: string;
  evidenceHash: string;
  message?: string;
};

export interface VerificationAdapter<TInput = unknown, TResult = unknown> {
  id: string;
  name: string;
  verify(input: TInput): Promise<AdapterResult<TResult>>;
}
