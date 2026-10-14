import { actions } from "astro:actions";
import { navigate } from "astro:transitions/client";
import { GalleryHorizontalEnd, Pencil, CircleCheck, Trash } from "lucide-react";
import { IconButton } from "./icon-button";
import { confirmDialog } from "./confirm-dialog";

interface DocumentMenuProps {
    id: string,
    document: string,
    version: number | null,
    translations: Record<string, string>;
};

export const DocumentMenu = ({ id, document, version, translations }: DocumentMenuProps) => {
    const versionsView = window.location.pathname.includes("versions");
    return (
        <div className="flex gap-2" onClick={event => event.preventDefault()}>
            {!versionsView
                ? <IconButton icon={GalleryHorizontalEnd} tooltip={translations["client-history"]} onClick={() => {
                    navigate(`/docs/versions/${document}`);
                }}></IconButton>
                : version
                    ? <IconButton icon={Pencil} tooltip={translations["client-edit"]} onClick={async () => {
                        const { error } = await actions.duplicateDocument(id);
                        if (!error) setTimeout(() => navigate(""), 250);
                    }}></IconButton>
                    : <IconButton icon={CircleCheck} tooltip={translations["client-release"]} onClick={async () => {
                        const { error } = await actions.publishDocument(id);
                        if (!error) setTimeout(() => navigate(""), 250);
                    }}></IconButton>
            }
            <IconButton icon={Trash} tooltip={translations["client-delete"]} onClick={async () => {
                const confirmed = await confirmDialog({
                    title: translations["client-delete-title"],
                    description: translations[versionsView ? "client-delete-version" : "client-delete-document"],
                    cancel: translations["client-cancel"],
                    action: translations["client-delete"]
                });
                if (!confirmed) return;

                const { data, error } = versionsView
                    ? await actions.deleteDocument(id)
                    : await actions.deleteDocuments(document);

                if (data && !error) setTimeout(() => navigate(data), 250);
            }}></IconButton>
        </div>
    );
};
