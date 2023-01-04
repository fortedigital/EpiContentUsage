import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ROWS_PER_PAGE_DEFAULT_OPTIONS } from "../../Components/Filters/NumberOfRowsFilter";
import { SortDirection, TableColumn } from "../../types";
import { useDebounce } from "./useDebounce";

enum FilteredTableDataQueryParam {
  SortBy = "sortBy",
  Order = "order",
  Query = "query",
  ShowColumn = "showColumn",
  Page = "page",
  RowsPerPage = "rowsPerPage",
}

interface FilteredTableDataHookOptions<TableDataType> {
  rows: TableDataType[];
  initialTableColumns: TableColumn<TableDataType>[];
  initialSortDirection?: SortDirection;
  rowsPerPageOptions?: number[];
  sortCompareFn?: (
    prevValue: TableDataType,
    nextValue: TableDataType
  ) => number;
  filterFn?: (row: TableDataType, searchValue: string) => boolean;
}

export function useFilteredTableData<TableDataType>({
  rows,
  initialTableColumns,
  initialSortDirection = SortDirection.Ascending,
  rowsPerPageOptions = ROWS_PER_PAGE_DEFAULT_OPTIONS,
  sortCompareFn,
  filterFn,
}: FilteredTableDataHookOptions<TableDataType>): {
  rows: TableDataType[];
  searchValue: string;
  onSearchChange: React.KeyboardEventHandler<HTMLInputElement>;
  onClearButtonClick: React.MouseEventHandler<HTMLButtonElement>;
  tableColumns: TableColumn<TableDataType>[];
  useTableColumns: (callbackFn: (...args: boolean[]) => string) => string;
  onTableColumnChange: (column: string, visible: boolean) => void;
  selectedRowsPerPage: number;
  onRowsPerPageChange: (option: number) => void;
  sortDirection: SortDirection;
  onSortChange: (column: TableColumn<TableDataType>) => void;
  totalPages: number;
  currentPage: number;
  goToPage: (page: number) => void;
} {
  const [datasetChanged, setDatasetChanged] = useState<boolean>(false);
  const [searchFieldValue, setSearchFieldValue] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [sortBy, setSortBy] = useState<keyof TableDataType | null>(null);
  const [sortDirection, setSortDirection] =
    useState<SortDirection>(initialSortDirection);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [rowsPerPage, setRowsPerPage] = useState<number>(rowsPerPageOptions[0]);
  const [tableColumns, setTableColumns] = useState<
    TableColumn<TableDataType>[]
  >(
    initialTableColumns.map((column) => ({
      visible: true,
      filter: true,
      ...column,
    }))
  );
  const [searchParams, setSearchParams] = useSearchParams();

  const useTableColumns = useCallback(
    (callbackFn: (...args: boolean[]) => string) => {
      const columns = tableColumns.map((column) => column.visible);
      return callbackFn(...columns);
    },
    [tableColumns]
  );

  const handleTableSort = useCallback(
    (column: TableColumn<TableDataType>) => {
      if (!tableColumns.find(({ id }) => id === column.id)) return;
      // If the user isn't switching sort columns, toggle the sort direction
      const sortToggleMap = {
        [SortDirection.Ascending]: SortDirection.Descending,
        [SortDirection.Descending]: SortDirection.Ascending,
      };
      let newOrder = SortDirection.Ascending;

      if (sortBy === column.id) {
        newOrder = sortToggleMap[sortDirection];
      }

      setSearchParams((prevSearchParams) => {
        prevSearchParams.set(
          FilteredTableDataQueryParam.SortBy,
          column.id.toString()
        );
        prevSearchParams.set(FilteredTableDataQueryParam.Order, newOrder);
        return prevSearchParams;
      });
      setCurrentPage(1);
      setSortBy(column.id as keyof TableDataType);
      setSortDirection(newOrder);
    },
    [setCurrentPage, setSortBy, setSortDirection, sortBy, sortDirection]
  );

  const handleSearch = useDebounce(
    (value: string) => {
      setSearchParams((prevSearchParams) => {
        if (value)
          prevSearchParams.set(FilteredTableDataQueryParam.Query, value);
        else prevSearchParams.delete(FilteredTableDataQueryParam.Query);
        return prevSearchParams;
      });
      setCurrentPage(1);
      setSearchQuery(value);
    },
    300,
    []
  );

  const onSearchValueChange: React.KeyboardEventHandler<HTMLInputElement> =
    useCallback(
      (event) => {
        event.persist();
        setSearchFieldValue(event.currentTarget.value);
        handleSearch(event.currentTarget.value);
      },
      [handleSearch]
    );

  const onClearButtonClick: React.MouseEventHandler<HTMLButtonElement> =
    useCallback(
      (event) => {
        event.persist();
        setSearchFieldValue("");
        handleSearch("");
      },
      [handleSearch]
    );

  const changeColumnVisibility = useCallback(
    (id: string, visible: boolean) => {
      const newTableColumns = tableColumns.slice(0);
      const columnIndex = newTableColumns.findIndex(
        (column) => column.id === id
      );
      newTableColumns[columnIndex].visible = visible;
      if (!visible && newTableColumns[columnIndex].id === sortBy)
        setSortBy(null);

      setSearchParams((prevSearchParams) => {
        prevSearchParams.delete(FilteredTableDataQueryParam.ShowColumn);
        newTableColumns
          .filter((column) => column.visible)
          .forEach((column) =>
            prevSearchParams.append(
              FilteredTableDataQueryParam.ShowColumn,
              column.id.toString()
            )
          );
        return prevSearchParams;
      });
      setTableColumns(newTableColumns);
    },
    [tableColumns, setTableColumns, setSortBy, sortBy]
  );

  const onColumnVisiblityChange = useCallback(
    (id: string, visible: boolean) => {
      if (tableColumns.filter((column) => column.visible).length > 1 || visible)
        changeColumnVisibility(id, visible);
    },
    [tableColumns, changeColumnVisibility]
  );

  const handlePageChange = useCallback(
    (page: number) => {
      setSearchParams((prevSearchParams) => {
        prevSearchParams.set(FilteredTableDataQueryParam.Page, page.toString());
        return prevSearchParams;
      });
      setCurrentPage(page);
    },
    [setCurrentPage]
  );

  const onRowsPerPageChange = useCallback(
    (option: number) => {
      setSearchParams((prevSearchParams) => {
        prevSearchParams.set(
          FilteredTableDataQueryParam.RowsPerPage,
          option.toString()
        );
        return prevSearchParams;
      });
      setRowsPerPage(option);
      handlePageChange(1);
    },
    [handlePageChange]
  );

  const filteredItems = useMemo(() => {
    return rows
      .filter((row) => {
        const parsedSearchValue = searchQuery.toLocaleLowerCase().trim();
        if (!parsedSearchValue) return true;

        if (filterFn) return filterFn(row, searchQuery);

        for (const column in row) {
          const tableColumn = tableColumns.find(({ name }) => name === column);

          if (tableColumn && tableColumn.filter && tableColumn.visible) {
            const value = row[column];
            if (
              typeof value === "string" &&
              value
                .toLocaleLowerCase()
                .includes(parsedSearchValue.toLocaleLowerCase())
            )
              return true;

            if (
              typeof value === "number" &&
              parseInt(parsedSearchValue) === value
            )
              return true;
          }
        }

        return false;
      })
      .sort((prevValue, nextValue) => {
        if (!sortBy) return 0;

        if (sortCompareFn) return sortCompareFn(prevValue, nextValue);

        if (!prevValue[sortBy]) return 1;

        if (sortDirection === SortDirection.Descending)
          return prevValue[sortBy] > nextValue[sortBy] ? -1 : 1;
        else if (sortDirection === SortDirection.Ascending)
          return prevValue[sortBy] > nextValue[sortBy] ? 1 : -1;
        else return 0;
      });
  }, [rows, tableColumns, sortDirection, sortBy, searchQuery, sortCompareFn]);

  const tableRows = useMemo(
    () =>
      filteredItems.slice(
        (currentPage - 1) * rowsPerPage,
        (currentPage - 1) * rowsPerPage + rowsPerPage
      ),
    [filteredItems, currentPage, rowsPerPage]
  );

  const totalPages = useMemo(
    () => Math.ceil(filteredItems.length / rowsPerPage),
    [filteredItems, rowsPerPage]
  );

  const handleUpdateQueryParams = useCallback(
    (queryParams: URLSearchParams) => {
      if (queryParams.has(FilteredTableDataQueryParam.SortBy)) {
        const param = queryParams.get(
          FilteredTableDataQueryParam.SortBy
        ) as keyof TableDataType;
        if (
          tableColumns
            .filter((column) => column.visible)
            .map((column) => column.id)
            .includes(param)
        )
          setSortBy(param);
      }

      if (queryParams.has(FilteredTableDataQueryParam.Order)) {
        const param = queryParams.get(FilteredTableDataQueryParam.Order);
        if (
          param === SortDirection.Ascending ||
          param === SortDirection.Descending
        )
          setSortDirection(param);
      }

      if (queryParams.has(FilteredTableDataQueryParam.Query)) {
        const param = queryParams.get(FilteredTableDataQueryParam.Query);
        const value = encodeURIComponent(param);
        setSearchFieldValue(value);
        setSearchQuery(value);
      }

      if (queryParams.has(FilteredTableDataQueryParam.ShowColumn)) {
        const columns = queryParams.getAll(
          FilteredTableDataQueryParam.ShowColumn
        );
        setTableColumns((tableColumns) => {
          const newTableColumns = tableColumns.slice(0).map((tableColumn) => ({
            ...tableColumn,
            visible: false,
          }));

          columns.forEach((column) => {
            const tableColumnIndex = newTableColumns.findIndex(
              (tableColumn) => tableColumn.id === column
            );
            if (tableColumnIndex > -1) {
              newTableColumns[tableColumnIndex].visible = true;
            }
          });

          return newTableColumns;
        });
      }

      if (queryParams.has(FilteredTableDataQueryParam.RowsPerPage)) {
        const param = queryParams.get(FilteredTableDataQueryParam.RowsPerPage);
        const number = parseInt(param);
        if (!Number.isNaN(number) && rowsPerPageOptions.includes(number)) {
          setRowsPerPage(number);
        }
      }

      if (queryParams.has(FilteredTableDataQueryParam.Page)) {
        const param = queryParams.get(FilteredTableDataQueryParam.Page);
        const number = parseInt(param);
        if (!Number.isNaN(number) && number > 0 && number <= totalPages) {
          setCurrentPage(number);
        }
      }
    },
    [totalPages]
  );

  useEffect(() => setDatasetChanged(true), [rows]);

  useEffect(() => {
    if (datasetChanged && rows.length > 0 && totalPages > 0 && searchParams) {
      setDatasetChanged(false);
      handleUpdateQueryParams(searchParams);
    }
  }, [datasetChanged, rows, totalPages, searchParams]);

  return {
    rows: tableRows,
    searchValue: searchFieldValue,
    onSearchChange: onSearchValueChange,
    onClearButtonClick,
    tableColumns,
    useTableColumns,
    onTableColumnChange: onColumnVisiblityChange,
    selectedRowsPerPage: rowsPerPage,
    onRowsPerPageChange: onRowsPerPageChange,
    sortDirection,
    onSortChange: handleTableSort,
    totalPages,
    currentPage,
    goToPage: handlePageChange,
  };
}
