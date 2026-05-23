export interface ApiResponse<T> {
  data: T;
  error: null | {
    code: string;
    message: string;
  };
}
