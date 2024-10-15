import {Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle} from "@/components/ui/dialog";
import React, {ReactNode} from "react";

export interface DialogProps {
    children: ReactNode;
    isOpen: boolean;
    onClose: () => void;
    className?: string;
}

export default function DialogForm({onClose, isOpen, children, className}: DialogProps) {
    return (
        <Dialog open={isOpen} onOpenChange={onClose} modal={true} defaultOpen={false}>
            <DialogContent className={className}>
                <DialogHeader>
                    <DialogTitle />
                    <DialogDescription>
                        {children}
                    </DialogDescription>
                </DialogHeader>
            </DialogContent>
        </Dialog>
    )
}