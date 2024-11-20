import * as React from "react"

import {cn} from "@/utils/cn"
import {Loader} from "@/components/common";
import {ErrorHTMLMessage} from "@/components/common/customToast";

const Table = React.forwardRef<
    HTMLTableElement,
    React.HTMLAttributes<HTMLTableElement>
>(({className, ...props}, ref) => (
    <div className="relative w-full h-full overflow-auto">
        <table
            ref={ref}
            className={cn("w-full caption-bottom text-sm", className)}
            {...props}
        />
    </div>
))
Table.displayName = "Table"

const TableHeader = React.forwardRef<
    HTMLTableSectionElement,
    React.HTMLAttributes<HTMLTableSectionElement>
>(({className, ...props}, ref) => (
    <thead ref={ref}
           className={cn("[&_tr]:border-b [&_tr]:hover:bg-transparent font-semibold sticky top-0 opacity-100 z-10 bg-white border-b", className)} {...props} />
))
TableHeader.displayName = "TableHeader"

const TableBody = React.forwardRef<
    HTMLTableSectionElement,
    React.HTMLAttributes<HTMLTableSectionElement> & {
    isFetchingMoreData: boolean
    onEmpty: {
        isLoading: boolean
        error: Error | null
        hasFilter?: boolean
        isEmpty: boolean
        noDataMessage: string
        noFilteredDataMessage?: string
    }
}
>(({className, isFetchingMoreData, children, onEmpty, ...props}, ref) => {
    if (onEmpty.isEmpty) {
        return (
            <div
                className={cn("absolute top-[50%] left-[50%] translate-x-[-50%] translate-y-[-50%] text-center", className)}
            >
                {
                    onEmpty.isLoading ?
                        <Loader/> :
                        !!onEmpty.error ?
                            ErrorHTMLMessage("Помилка завантаження", onEmpty.error) :
                            onEmpty.isEmpty && onEmpty.hasFilter ?
                                onEmpty.noFilteredDataMessage :
                                onEmpty.isEmpty ?
                                    onEmpty.noDataMessage :
                                    null
                }
            </div>
        )
    }
    return (<tbody
        ref={ref}
        className={cn("[&_tr:last-child]:border-0", className)}
        {...props}
    >
    {children}
    <TableRow
        className={"absolute w-full flex justify-center"}
    >
        {isFetchingMoreData && <Loader/>}
    </TableRow>
    </tbody>)
})

TableBody.displayName = "TableBody"

const TableFooter = React.forwardRef<
    HTMLTableSectionElement,
    React.HTMLAttributes<HTMLTableSectionElement>
>(({className, ...props}, ref) => (
    <tfoot
        ref={ref}
        className={cn(
            "border-t bg-muted/50 font-medium [&>tr]:last:border-b-0",
            className
        )}
        {...props}
    />
))
TableFooter.displayName = "TableFooter"

const TableRow = React.forwardRef<
    HTMLTableRowElement,
    React.HTMLAttributes<HTMLTableRowElement>
>(({className, ...props}, ref) => (
    <tr
        ref={ref}
        className={cn(
            "border-b transition-colors hover:bg-blue-200 data-[state=selected]:bg-muted",
            className
        )}
        {...props}
    />
))
TableRow.displayName = "TableRow"

const TableHead = React.forwardRef<
    HTMLTableCellElement,
    React.ThHTMLAttributes<HTMLTableCellElement>
>(({className, ...props}, ref) => (
    <th
        ref={ref}
        className={cn(
            "h-10 px-2 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
            className
        )}
        {...props}
    />
))
TableHead.displayName = "TableHead"

const TableCell = React.forwardRef<
    HTMLTableCellElement,
    React.TdHTMLAttributes<HTMLTableCellElement>
>(({className, ...props}, ref) => (
    <td
        ref={ref}
        className={cn(
            "p-2 align-middle [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
            className
        )}
        {...props}
    />
))
TableCell.displayName = "TableCell"

const TableCaption = React.forwardRef<
    HTMLTableCaptionElement,
    React.HTMLAttributes<HTMLTableCaptionElement>
>(({className, ...props}, ref) => (
    <caption
        ref={ref}
        className={cn("mt-4 text-sm text-muted-foreground", className)}
        {...props}
    />
))
TableCaption.displayName = "TableCaption"

export {
    Table,
    TableHeader,
    TableBody,
    TableFooter,
    TableHead,
    TableRow,
    TableCell,
    TableCaption,
}
