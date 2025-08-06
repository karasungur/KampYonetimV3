#!/usr/bin/env python3
"""
PKL to JSON Batch Converter
Tüm PKL dosyalarını bir kerede JSON formatına çeviren sistem
"""
import os
import sys
import json
import shutil
import traceback
from pathlib import Path

def print_status(msg):
    """Status mesajları"""
    print(f"[STATUS] {msg}")

def print_error(msg):
    """Error mesajları"""
    print(f"[ERROR] {msg}", file=sys.stderr)

def safe_pkl_to_json(pkl_file_path):
    """PKL dosyasını güvenli şekilde JSON'a çevir"""
    try:
        import pickle
        
        # PKL dosyasını oku
        with open(pkl_file_path, 'rb') as f:
            # Dosya boyutunu kontrol et
            f.seek(0, 2)
            file_size = f.tell()
            f.seek(0)
            
            if file_size > 10 * 1024 * 1024:  # 10MB'dan büyükse dikkatli ol
                print_error(f"Large PKL file detected: {file_size} bytes - skipping")
                return None
            
            try:
                data = pickle.load(f)
            except Exception as e:
                print_error(f"Pickle load failed: {e}")
                return None
        
        # Veri tipini kontrol et
        if not isinstance(data, dict):
            print_error(f"PKL data is not dict: {type(data)}")
            return None
        
        # JSON uyumlu format'a çevir
        json_data = {}
        converted_count = 0
        
        for key, value in data.items():
            try:
                # Key'i string'e çevir
                str_key = key.decode('utf-8') if isinstance(key, bytes) else str(key)
                
                # Value'yu JSON serializable yap
                json_value = convert_to_json_serializable(value)
                
                if json_value is not None:
                    json_data[str_key] = json_value
                    converted_count += 1
                
            except Exception as e:
                print_error(f"Failed to convert key {key}: {e}")
                continue
        
        print_status(f"Converted {converted_count} face records from PKL")
        return json_data
        
    except Exception as e:
        print_error(f"PKL to JSON conversion failed: {e}")
        return None

def convert_to_json_serializable(obj):
    """Objeti JSON serializable formatına çevir"""
    try:
        # Numpy array kontrolü
        if hasattr(obj, 'tolist'):
            return obj.tolist()
        
        # Dict ise recursive işle
        if isinstance(obj, dict):
            result = {}
            for k, v in obj.items():
                key = k.decode('utf-8') if isinstance(k, bytes) else str(k)
                result[key] = convert_to_json_serializable(v)
            return result
        
        # List ise elemanları işle
        if isinstance(obj, (list, tuple)):
            return [convert_to_json_serializable(item) for item in obj]
        
        # Bytes'i string'e çevir
        if isinstance(obj, bytes):
            try:
                return obj.decode('utf-8')
            except:
                return str(obj)
        
        # Basic types
        if isinstance(obj, (str, int, float, bool)) or obj is None:
            return obj
        
        # Son çare: string'e çevir
        return str(obj)
        
    except Exception as e:
        print_error(f"JSON serialization failed: {e}")
        return None

def convert_model_directory(model_dir):
    """Model dizinindeki PKL dosyalarını JSON'a çevir"""
    model_path = Path(model_dir)
    
    if not model_path.exists():
        print_error(f"Model directory not found: {model_dir}")
        return False
    
    pkl_file = model_path / "face_database.pkl"
    json_file = model_path / "face_database.json"
    
    # PKL dosyası var mı kontrol et
    if not pkl_file.exists():
        print_status(f"No PKL file in {model_dir}")
        return True
    
    # JSON dosyası zaten var mı kontrol et
    if json_file.exists():
        print_status(f"JSON file already exists in {model_dir}")
        return True
    
    print_status(f"Converting PKL to JSON in {model_dir}")
    
    # PKL'den JSON'a çevir
    json_data = safe_pkl_to_json(pkl_file)
    
    if json_data is None:
        print_error(f"Failed to convert PKL in {model_dir}")
        return False
    
    # JSON dosyasını kaydet
    try:
        with open(json_file, 'w', encoding='utf-8') as f:
            json.dump(json_data, f, indent=2, ensure_ascii=False)
        
        print_status(f"JSON file created: {json_file}")
        print_status(f"Face count: {len(json_data)}")
        
        # PKL dosyasını backup olarak sakla
        backup_pkl = model_path / "face_database.pkl.backup"
        shutil.copy2(pkl_file, backup_pkl)
        print_status(f"PKL backed up to: {backup_pkl}")
        
        return True
        
    except Exception as e:
        print_error(f"Failed to save JSON file: {e}")
        return False

def batch_convert_all_models(models_root="./models"):
    """Tüm modelleri batch olarak çevir"""
    models_path = Path(models_root)
    
    if not models_path.exists():
        print_error(f"Models directory not found: {models_root}")
        return
    
    print_status(f"Starting batch conversion in {models_root}")
    
    success_count = 0
    total_count = 0
    
    # Her model dizinini kontrol et
    for model_dir in models_path.iterdir():
        if model_dir.is_dir():
            total_count += 1
            print_status(f"Processing model: {model_dir.name}")
            
            if convert_model_directory(model_dir):
                success_count += 1
            
            print_status("=" * 50)
    
    print_status(f"Batch conversion completed: {success_count}/{total_count} models")

if __name__ == "__main__":
    if len(sys.argv) > 1:
        # Tek model işle
        model_dir = sys.argv[1]
        convert_model_directory(model_dir)
    else:
        # Tüm modelleri işle
        batch_convert_all_models()