export interface OgrenciType {
    id?: number;
    ogrenciId?: number;
    ogrenciAd: string;
    ogrenciSoyad: string;
    veliAd: string;
    okul: string;
    sinif: string;
    aciklama1: string;
    aciklama2: string;
    kayitTarihi: string;
    ucret: number;
    ogrenciTel: string;
    veliTel: string;
    aktifmi: number; // 0 or 1
}

export interface DersType {
    id?: number;
    dersId?: number;
    ogrenciId: number;
    dersturu: string;
    konu: string;
    saat: string;
    tarih: string;
    ucret: string;
    ogrenciAdSoyad: string;
    sutun1?: string;
    sutun2?: string;
    sutun3?: string;
    sutun4?: string;
}

export interface KaynakType {
    id?: number;
    kaynakId?: number;
    ogrenciId: number;
    kaynak: string;
    sutun1?: string;
    sutun2?: string;
    sutun3?: string;
    sutun4?: string;
}

export interface OdevType {
    id?: number;
    odevId?: number;
    ogrenciId: number;
    kaynak: string;
    odev: string;
    verilmetarihi: string;
    teslimttarihi: string;
    kontroltarihi?: string;
    yapilmadurumu: string;
    aciklama: string;
    sutun1?: string;
    sutun2?: string;
    sutun3?: string;
    sutun4?: string;
}

export interface NotType {
    id?: number;
    notlarimId?: number;
    ogrenciId: number;
    tarih: string;
    not1: string;
    sutun1?: string;
    sutun2?: string;
    sutun3?: string;
}

export interface OdemeType {
    id?: number;
    odemeId?: number;
    ogrenciId: number;
    alinanucret: string;
    odemetarih: string;
    odemeturu: string;
    aciklama: string;
    odemesaati?: string;
    ogrenciAdSoyad?: string;
    sutun1?: string;
    sutun2?: string;
    sutun3?: string;
    sutun4?: string;
}

export interface AjandaType {
    ajandaId?: number;
    ogrenciId: number;
    ogrAdsoyad: string;
    tarih: string;
    saat: string;
    tekrarsayisi: string;
    kalanTekrarSayisi: string;
    olusmaAni: string;
    tamamlanma: string;
    tamamlandiMi?: number;
    iptal?: number;
    konu?: string;
    sutun1?: string;
    sutun2?: string;
}

export interface AjandaWithOgrenciType extends AjandaType {
    ogrenciAd?: string;
    ogrenciSoyad?: string;
}

export interface SinavTuruType {
    id?: number;
    ad: string;
}

export interface DenemeType {
    id?: number;
    ogrenciId: number;
    sinavTuruId: number;
    denemeAd: string;
    tarih: string;
    dogru: number;
    yanlis: number;
    // For joining queries:
    sinavTuruAd?: string;
}
