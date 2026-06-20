export type TPaginationResultMetadata = {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  totalItems: number;
};

export type TPaginationResult<T> = {
  data: Array<T>;
  metadata: TPaginationResultMetadata;
};
