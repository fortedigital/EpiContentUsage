export enum SortDirection {
  Ascending = "asc",
  Descending = "desc",
}

export interface TableColumn<TableDataType> {
  id: keyof TableDataType;
  name: string;
  visible?: boolean;
  filter?: boolean;
}
