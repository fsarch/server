export interface IPaginationResultMetadata {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  totalItems: number;
}

export interface IPaginationResult<T> {
  data: Array<T>;
  metadata: IPaginationResultMetadata;
}
