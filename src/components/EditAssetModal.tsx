import React, { useState } from 'react';
import { X, Save, Trash2, Camera, Loader2, HardDrive } from 'lucide-react';
import { OfficeAsset, AssetCategory, AssetCondition, AssetStatus, MasterBuildingLocation } from '../types';
import { parseAssetCode } from '../data/assetCodeGenerator';
import { CurrencyInput } from './CurrencyInput';
import {
  compressImageFileToDataUrl,
  normalizeDriveImageUrl,
} from '../services/driveService';
import { uploadConditionPhotoViaBridge } from '../services/cloudBridgeService';

interface EditAssetModalProps {
  isOpen: boolean;
  onClose: () => void;
  asset: OfficeAsset | null;
  cloudBridgeUrl?: string | null;
  cloudBridgeKey?: string;
  onSaveAsset: (updatedAsset: OfficeAsset) => void;
  onDeleteAsset: (assetId: string) => void;
  registeredLocations?: MasterBuildingLocation[];
}

const CATEGORIES: AssetCategory[] = [
  'IT & Elektronik',
  'Furnitur & Meja',
  'Peralatan Presentasi',
  'Kendaraan Operasional',
  'Perangkat Jaringan',
  'ATK & Suplai Kantor',
];

export const EditAssetModal: React.FC<EditAssetModalProps> = ({
  isOpen,
  onClose,
  asset,
  cloudBridgeUrl,
  cloudBridgeKey,
  onSaveAsset,
  onDeleteAsset,
  registeredLocations = [],
}) => {
  if (!isOpen || !asset) return null;

  const [id, setId] = useState(asset.id);
  const [name, setName] = useState(asset.name);
  const [category, setCategory] = useState<AssetCategory>(asset.category);
  const [sku, setSku] = useState(asset.sku);
  const [totalStock, setTotalStock] = useState<number>(asset.totalStock);
  const [availableStock, setAvailableStock] = useState<number>(asset.availableStock);
  const [location, setLocation] = useState(asset.location);
  const [condition, setCondition] = useState<AssetCondition>(asset.condition);
  const [status] = useState<AssetStatus>(asset.status);
  const [custodian, setCustodian] = useState(asset.custodian);
  const [purchasePrice, setPurchasePrice] = useState<number>(asset.purchasePrice);
  const [purchaseDate, setPurchaseDate] = useState(asset.purchaseDate);
  const [notes, setNotes] = useState(asset.notes);

  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string>(
    normalizeDriveImageUrl(asset.lastPhotoUrl || '')
  );
  const [isSaving, setIsSaving] = useState(false);

  const parsed = parseAssetCode(id);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setPhotoFile(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      let nextPhotoUrl = asset.lastPhotoUrl || '';
      let nextPhotoDate = asset.lastPhotoDate || '';

      if (photoFile) {
        if (cloudBridgeUrl) {
          try {
            const driveResult = await uploadConditionPhotoViaBridge(
              cloudBridgeUrl,
              photoFile,
              `UPDATE_${id.trim().replace(/\./g, '_')}_${todayStr}.jpg`,
              id.trim(),
              todayStr,
              cloudBridgeKey
            );
            nextPhotoUrl = driveResult.imageUrl;
            nextPhotoDate = todayStr;
          } catch (driveErr) {
            console.warn('Drive upload error during asset edit:', driveErr);
            nextPhotoUrl = await compressImageFileToDataUrl(photoFile, 480, 0.7).catch(() => nextPhotoUrl);
            nextPhotoDate = todayStr;
          }
        } else {
          nextPhotoUrl = await compressImageFileToDataUrl(photoFile, 480, 0.7).catch(() => nextPhotoUrl);
          nextPhotoDate = todayStr;
        }
      }

      const updated: OfficeAsset = {
        ...asset,
        id: id.trim(),
        name: name.trim(),
        category,
        sku: sku.trim(),
        totalStock,
        availableStock: Math.min(availableStock, totalStock),
        location: location.trim(),
        condition,
        status,
        custodian: custodian.trim(),
        purchasePrice,
        purchaseDate,
        lastPhotoUrl: nextPhotoUrl,
        lastPhotoDate: nextPhotoDate,
        notes: notes.trim(),
        updatedAt: new Date().toISOString(),
      };

      onSaveAsset(updated);
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = () => {
    if (confirm(`Yakin ingin menghapus aset "${asset.name}" (${asset.id}) dari database?`)) {
      onDeleteAsset(asset.id);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-6">
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold">Edit Detail Aset</h3>
            <p className="text-xs text-slate-400 font-mono">Kode Aset: {asset.id}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="text-slate-400 hover:text-white p-1 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* Kode Resep Info Box */}
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-amber-900 uppercase">
                Kode Barang Standar [XX].[XX].[XXX].[XXX].[XX]
              </span>
              <span className="text-[10px] text-amber-700 font-medium">Resep Kode Aktif</span>
            </div>
            <input
              type="text"
              value={id}
              onChange={(e) => setId(e.target.value)}
              className="w-full px-3 py-1.5 bg-white border border-amber-300 rounded-lg text-xs font-mono font-black text-slate-900 tracking-wider"
            />
            {parsed.isValid && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 text-[10px] text-slate-600 pt-1">
                <div>Bidang: <strong>[{parsed.bidang}] {parsed.bidangName.slice(0, 15)}...</strong></div>
                <div>Divisi: <strong>[{parsed.divisi}] {parsed.divisiName}</strong></div>
                <div>Sub: <strong>[{parsed.subKelompok}] {parsed.subKelompokName}</strong></div>
                <div>Urut: <strong>[{parsed.urutan}] Tahun: &apos;{parsed.tahun}</strong></div>
              </div>
            )}
          </div>

          {/* Photo Update Section (Google Drive) */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-4">
            {photoPreview ? (
              <img
                src={photoPreview}
                alt={name}
                className="w-16 h-16 rounded-xl object-cover border border-slate-300 shrink-0 bg-white"
              />
            ) : (
              <div className="w-16 h-16 rounded-xl bg-slate-200 border border-dashed border-slate-300 flex items-center justify-center text-slate-400 shrink-0">
                <Camera className="w-6 h-6" />
              </div>
            )}
            <div className="flex-1 min-w-0 space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                <HardDrive className="w-3.5 h-3.5 text-indigo-600" />
                <span>Foto Fisik Aset (Simpan ke Google Drive)</span>
              </div>
              <input
                type="file"
                accept="image/*"
                onChange={handlePhotoChange}
                className="block w-full text-xs text-slate-500 file:mr-2.5 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-[11px] file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
              {!cloudBridgeUrl && photoFile && (
                <p className="text-[10px] text-amber-700">
                  Cloud Bridge Drive belum terhubung — foto dikompres sementara secara lokal.
                </p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Nama Aset *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Kategori
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as AssetCategory)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Barcode / SKU
              </label>
              <input
                type="text"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Total Stok
              </label>
              <input
                type="number"
                min="0"
                value={totalStock}
                onChange={(e) => setTotalStock(parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Stok Tersedia
              </label>
              <input
                type="number"
                min="0"
                value={availableStock}
                onChange={(e) => setAvailableStock(parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Kondisi Fisik
              </label>
              <select
                value={condition}
                onChange={(e) => setCondition(e.target.value as AssetCondition)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
              >
                <option value="Baik">Baik</option>
                <option value="Perlu Perbaikan">Perlu Perbaikan</option>
                <option value="Rusak Ringan">Rusak Ringan</option>
                <option value="Rusak Berat">Rusak Berat</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-700">
                  Lokasi Penempatan
                </label>
                {registeredLocations.length > 0 && (
                  <span className="text-[10px] text-blue-600 font-semibold">
                    {registeredLocations.length} titik master
                  </span>
                )}
              </div>
              <input
                type="text"
                list="edit-registered-locations-list"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
              />
              <datalist id="edit-registered-locations-list">
                {registeredLocations.map((loc) => (
                  <option
                    key={loc.id}
                    value={`${loc.buildingName} - ${loc.floor} (${loc.roomName})`}
                  />
                ))}
              </datalist>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                PIC Penanggung Jawab
              </label>
              <input
                type="text"
                value={custodian}
                onChange={(e) => setCustodian(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Harga Perolehan (IDR)
              </label>
              <CurrencyInput
                value={purchasePrice}
                onChange={setPurchasePrice}
                placeholder="0"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Tanggal Perolehan
              </label>
              <input
                type="date"
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Catatan &amp; Spesifikasi
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
            ></textarea>
          </div>

          <div className="border-t border-slate-200 pt-4 flex items-center justify-between">
            <button
              type="button"
              onClick={handleDelete}
              disabled={isSaving}
              className="flex items-center gap-1.5 px-3 py-2 text-rose-600 hover:bg-rose-50 rounded-lg text-xs font-semibold transition"
            >
              <Trash2 className="w-4 h-4" />
              <span>Hapus Aset</span>
            </button>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isSaving}
                className="px-4 py-2 border border-slate-200 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-100"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="flex items-center gap-1.5 px-5 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white text-xs font-semibold rounded-lg shadow-xs"
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                <span>{isSaving ? 'Mengunggah & Menyimpan...' : 'Simpan Perubahan'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
