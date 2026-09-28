import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";

interface DeleteConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  itemName: string;
  confirmButtonText?: string;
}

const DeleteConfirmationModal = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  itemName,
  confirmButtonText,
}: DeleteConfirmationModalProps) => {
  // 自维护 fork：文案接 i18n（action.* 在 common 命名空间）
  const { t } = useTranslation("common");
  const [confirmationText, setConfirmationText] = useState("");

  const handleClose = () => {
    setConfirmationText("");
    onClose();
  };

  const handleConfirm = () => {
    onConfirm();
    setConfirmationText("");
  };

  const isDeleteEnabled = confirmationText === itemName;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription className="mb-4">{description}</DialogDescription>

        <div className="space-y-4">
          {/* "请输入 X 以确认" —— X 需要加粗，故拆成前后两段拼接，
              而不是用 <Trans>（这里只有一个插值，拆分更直观且可测） */}
          <p className="text-sm text-[#565553]">
            {t("action.confirmTypePrefix")}
            <span className="font-bold">{itemName}</span>
            {t("action.confirmTypeSuffix")}
          </p>
          <Input
            type="text"
            placeholder={t("action.confirmPlaceholder")}
            value={confirmationText}
            onChange={(e) => setConfirmationText(e.target.value)}
            className="w-full"
          />
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <Button onClick={handleClose} variant="outline">
            {t("action.cancel")}
          </Button>
          <Button
            onClick={handleConfirm}
            variant="destructive"
            disabled={!isDeleteEnabled}
          >
            {confirmButtonText ?? t("action.delete")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DeleteConfirmationModal;
