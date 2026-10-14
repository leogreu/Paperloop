import { createRoot } from "react-dom/client";

import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export interface ConfirmDialogTexts {
    title: string,
    description: string,
    cancel: string,
    action: string
};

// Asks like confirm(), which embedded browsers may not support, but looks like the other dialogs;
// closing it in any other way than with the action, e.g. with escape, counts as cancelling
export const confirmDialog = ({ title, description, cancel, action }: ConfirmDialogTexts) => {
    return new Promise<boolean>(resolve => {
        const container = document.body.appendChild(document.createElement("div"));
        const root = createRoot(container);
        let confirmed = false;

        root.render(
            <AlertDialog defaultOpen onOpenChange={open => {
                if (open) return;
                // Unmounted once React has handled the closing event
                setTimeout(() => {
                    root.unmount();
                    container.remove();
                });
                resolve(confirmed);
            }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{title}</AlertDialogTitle>
                        <AlertDialogDescription>{description}</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>{cancel}</AlertDialogCancel>
                        <AlertDialogAction onClick={() => { confirmed = true; }}>{action}</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        );
    });
};
