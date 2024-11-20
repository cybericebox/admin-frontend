import {Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle} from "@/components/ui/dialog";
import React, {ReactNode} from "react";

export interface DialogProps {
    children: ReactNode;
    isOpen: boolean;
    onClose: () => void;
    className?: string;
    preventFocusOnOpen?: boolean;
}

export default function DialogForm({onClose, isOpen, children, className, preventFocusOnOpen}: DialogProps) {
    return (
        <Dialog open={isOpen} onOpenChange={onClose} modal={true} defaultOpen={false}>
            <DialogContent className={className} onOpenAutoFocus={(e) => {
                if (preventFocusOnOpen) {
                    e.preventDefault()
                }
            }}>
                <DialogHeader>
                    <DialogTitle/>
                    <DialogDescription>
                        {children}
                    </DialogDescription>
                </DialogHeader>
            </DialogContent>
        </Dialog>
    )
}