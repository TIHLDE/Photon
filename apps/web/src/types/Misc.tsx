export interface RequestResponse {
  detail: string;
  [k: string]: any;
}

export interface ApiResponse<T> {
    data: T;
    success: boolean;
    messsage?: string;
}