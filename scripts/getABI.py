#!/usr/bin/env python3

import json
import os
import subprocess
import shutil
import sys
import hashlib

def getAbi(inFname, abiFname) :
  # Opening JSON file 
  f = open(inFname, 'r') 
    
  # returns JSON object as  
  # a dictionary 
  data = json.load(f) 
    
  # Iterating through the json list 
  if 'abi' in data and len(data['abi']) > 0: 
    with open(abiFname, 'w') as f2:
      f2.write("{\n\"abi\" :\n")
      json.dump(data['abi'], f2, indent=4)
      f2.write("\n}")
    
  # Closing file 
  f.close() 


def compileContracts():
   process = subprocess.Popen(['npx', 'buidler', 'compile', '--force'],
                       stdout=subprocess.PIPE, 
                       stderr=subprocess.PIPE)
   stdout, stder = process.communicate()
   print(stdout, stder)


def checkHash(fname):
    hash_md5 = hashlib.md5()
    with open(fname, "rb") as f:
        for chunk in iter(lambda: f.read(4096), b""):
            hash_md5.update(chunk)

    return hash_md5.hexdigest()


if len(sys.argv) >= 3 :
  print("Incorrect command")
  print("Use : ./scripts/getAbi.py [OPTION]")
  print("OPTION :")
  print(" - no option : Generate ABIs")
  print(" - something : Compare ABIs")
  sys.exit(1)


artifactsFolder = './artifacts'
cacheFolder = './cache'
abiFolder = './abi'
abiFolderTmp = '/tmp/abi'

deleteArtifacts = False
generateABI = False
checkABI = False

if len(sys.argv) == 1:
  generateABI = True 
else:
  checkABI = True

if generateABI:
  print("Selected Generate ABIs...")
  # mkdir abiFolder
  if not os.path.exists(abiFolder):
      os.makedirs(abiFolder)
  
  if not os.path.exists(artifactsFolder):
     deleteArtifacts = True
  
  # Compile contracts
  print("Compiling contracts...")
  compileContracts()
  
  # Get artifacts
  artifacts = os.listdir(artifactsFolder)
  
  # Retrieve abi
  print("Extracting  ABIs...")
  for artifact in artifacts:
    if artifact.startswith('.'):
      continue
    getAbi(artifactsFolder+'/'+artifact, abiFolder+'/'+artifact)
  
  # Delete artifact/cache folders
  if deleteArtifacts:
      shutil.rmtree(artifactsFolder)
      shutil.rmtree(cacheFolder)

if checkABI:
  print("Selected Compare ABIs...")
  # mkdir abiFolder
  if os.path.exists(abiFolderTmp):
     shutil.rmtree(abiFolderTmp)

  if not os.path.exists(abiFolder):
     print("ABI folder doesn't exit")
     sys.exit(1)

  if not os.path.exists(abiFolderTmp):
      os.makedirs(abiFolderTmp)
  
  if not os.path.exists(artifactsFolder):
     deleteArtifacts = True
  
  # Compile contracts
  print("Compiling contracts...")
  compileContracts()
  
  # Get artifacts
  artifacts = os.listdir('.')
  print (artifacts)
  artifacts = os.listdir(artifactsFolder)
  
  # Retrieve abi
  print("Extracting  ABIs...")
  for artifact in artifacts:
    if artifact.startswith('.'):
      continue
    getAbi(artifactsFolder+'/'+artifact, abiFolderTmp+'/'+artifact)
  
  # Compute hash
  print("Computing checksum...")
  abis = os.listdir(abiFolder)
  abisTmp = os.listdir(abiFolderTmp)
  abis.sort() 
  abisTmp.sort()
  if abis != abisTmp:
     print("ABI contracts don't match with actual contracts")
     sys.exit(1)

  for abi in abis:
    h1 = checkHash(abiFolderTmp+'/'+abi)
    h2 = checkHash(abiFolder+'/'+abi)
    if h1 != h2 :
      print("ABI of not equal. File : ",abi)
      sys.exit(1)

  shutil.rmtree(abiFolderTmp)
  
# Delete artifact/cache folders
if deleteArtifacts:
    shutil.rmtree(artifactsFolder)
    shutil.rmtree(cacheFolder)
  
