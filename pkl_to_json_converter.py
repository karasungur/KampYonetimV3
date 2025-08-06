#!/usr/bin/env python3
"""
PKL to JSON Converter - Numpy bağımlılığını kaldırmak için
"""
import pickle
import json
import sys
import os

def convert_numpy_array(obj):
    """Numpy array'leri Python listelerine dönüştür"""
    if hasattr(obj, 'tolist'):
        try:
            return obj.tolist()
        except:
            pass
    
    if hasattr(obj, '__iter__') and not isinstance(obj, (str, bytes)):
        try:
            return list(obj)
        except:
            pass
    
    return obj

def convert_data_recursive(data):
    """Veriyi recursive olarak numpy-free hale getir"""
    if isinstance(data, dict):
        return {k: convert_data_recursive(v) for k, v in data.items()}
    elif isinstance(data, list):
        return [convert_data_recursive(item) for item in data]
    elif isinstance(data, tuple):
        return tuple(convert_data_recursive(item) for item in data)
    else:
        return convert_numpy_array(data)

def pkl_to_json(pkl_path, json_path=None):
    """PKL dosyasını JSON'a dönüştür"""
    if json_path is None:
        json_path = pkl_path.replace('.pkl', '.json')
    
    print(f"Converting {pkl_path} to {json_path}")
    
    try:
        # PKL dosyasını oku
        with open(pkl_path, 'rb') as f:
            data = pickle.load(f)
        
        print(f"PKL loaded successfully: {len(data) if isinstance(data, dict) else 'non-dict'} records")
        
        # Numpy array'leri dönüştür
        converted_data = convert_data_recursive(data)
        
        # JSON olarak kaydet
        with open(json_path, 'w', encoding='utf-8') as f:
            json.dump(converted_data, f, indent=2, ensure_ascii=False)
        
        print(f"Successfully converted to JSON: {json_path}")
        print(f"Converted {len(converted_data) if isinstance(converted_data, dict) else 'data'} records")
        
        return True
        
    except Exception as e:
        print(f"Conversion failed: {e}")
        return False

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python3 pkl_to_json_converter.py <pkl_file> [json_file]")
        sys.exit(1)
    
    pkl_file = sys.argv[1]
    json_file = sys.argv[2] if len(sys.argv) > 2 else None
    
    if not os.path.exists(pkl_file):
        print(f"PKL file not found: {pkl_file}")
        sys.exit(1)
    
    success = pkl_to_json(pkl_file, json_file)
    sys.exit(0 if success else 1)