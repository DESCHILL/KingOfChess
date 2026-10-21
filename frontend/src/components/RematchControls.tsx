type Props = {
    requested: boolean;
    pending: boolean;
    disabled?: boolean;
    alone?: boolean;
    onRequest: () => void;
    onCancel: () => void;
};

export const RematchControls = ({ requested, pending, disabled, alone, onRequest, onCancel }: Props) => <div className="mt-6 border-t border-white/10 pt-5">
    <button className="room-primary" disabled={disabled || requested} onClick={onRequest}>{requested ? "Đã gửi yêu cầu" : pending ? "Đồng ý đấu trận mới" : "Đấu trận mới"}</button>
    <p role="status" className="text-sm text-slate-400 mt-3">{alone ? "Đối thủ đã rời. Bắt đầu ván mới để chờ người chơi khác." : requested ? "Đang chờ đối thủ đồng ý. Ván hiện tại vẫn được giữ nguyên." : pending ? "Đối thủ muốn bắt đầu lại. Đồng ý sẽ xóa bàn cờ hiện tại và đổi màu quân." : "Hai người cùng đồng ý để đặt lại bàn cờ và đổi màu quân."}</p>
    {pending && <button disabled={disabled} className="room-secondary mt-3" onClick={onCancel}>{requested ? "Hủy yêu cầu" : "Từ chối"}</button>}
</div>;
