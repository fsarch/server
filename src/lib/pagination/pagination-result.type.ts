export type PaginationResultMetadata = {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  totalItems: number;
};

export type PaginationResult<T> = {
  data: Array<T>;
  metadata: PaginationResultMetadata;
};
