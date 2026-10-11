import React, { useState, useCallback } from 'react';
import { ScrollView, Text, View, Pressable, TextInput, Modal, Alert } from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import * as Haptics from 'expo-haptics';

interface DApp {
  id: string;
  name: string;
  description: string;
  blockchain: 'ethereum' | 'polygon' | 'solana' | 'arbitrum' | 'optimism';
  smartContracts: SmartContract[];
  features: string[];
  createdAt: Date;
}

interface SmartContract {
  id: string;
  name: string;
  type: 'token' | 'nft' | 'defi' | 'dao' | 'custom';
  code: string;
  deployed: boolean;
  address?: string;
}

const DAPP_TEMPLATES = [
  {
    id: 'erc20-token',
    name: 'ERC-20 Token',
    description: 'Create your own cryptocurrency token',
    icon: '💰',
    blockchain: 'ethereum',
    contracts: 1,
  },
  {
    id: 'nft-collection',
    name: 'NFT Collection',
    description: 'Launch an NFT marketplace',
    icon: '🎨',
    blockchain: 'polygon',
    contracts: 2,
  },
  {
    id: 'defi-swap',
    name: 'DeFi Swap',
    description: 'Create a decentralized exchange',
    icon: '🔄',
    blockchain: 'ethereum',
    contracts: 3,
  },
  {
    id: 'dao-governance',
    name: 'DAO Governance',
    description: 'Build a decentralized autonomous organization',
    icon: '🏛️',
    blockchain: 'ethereum',
    contracts: 2,
  },
  {
    id: 'staking-protocol',
    name: 'Staking Protocol',
    description: 'Create a staking and rewards system',
    icon: '📈',
    blockchain: 'solana',
    contracts: 2,
  },
  {
    id: 'lending-protocol',
    name: 'Lending Protocol',
    description: 'Build a decentralized lending platform',
    icon: '🏦',
    blockchain: 'arbitrum',
    contracts: 3,
  },
];

const BLOCKCHAINS = [
  { id: 'ethereum', name: 'Ethereum', icon: 'Ξ', gas: 'High', speed: 'Slow' },
  { id: 'polygon', name: 'Polygon', icon: '◆', gas: 'Low', speed: 'Fast' },
  { id: 'solana', name: 'Solana', icon: '◎', gas: 'Very Low', speed: 'Very Fast' },
  { id: 'arbitrum', name: 'Arbitrum', icon: 'Ⓐ', gas: 'Low', speed: 'Fast' },
  { id: 'optimism', name: 'Optimism', icon: 'Ⓞ', gas: 'Low', speed: 'Fast' },
];

const SMART_CONTRACT_TYPES = [
  { id: 'token', name: 'Token (ERC-20)', icon: '💰', description: 'Standard token contract' },
  { id: 'nft', name: 'NFT (ERC-721)', icon: '🎨', description: 'Non-fungible token' },
  { id: 'defi', name: 'DeFi Protocol', icon: '🔄', description: 'Decentralized finance' },
  { id: 'dao', name: 'DAO', icon: '🏛️', description: 'Governance contract' },
  { id: 'custom', name: 'Custom', icon: '⚙️', description: 'Custom smart contract' },
];

export default function DAppBuilderScreen() {
  const [dapps, setDapps] = useState<DApp[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [dappName, setDappName] = useState('');
  const [showNameInput, setShowNameInput] = useState(false);
  const [selectedBlockchain, setSelectedBlockchain] = useState<'ethereum' | 'polygon' | 'solana' | 'arbitrum' | 'optimism'>('ethereum');

  const handleCreateFromTemplate = useCallback((templateId: string) => {
    setSelectedTemplate(templateId);
    setShowNameInput(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const handleCreateDApp = useCallback(() => {
    if (!dappName.trim() || !selectedTemplate) {
      Alert.alert('Error', 'Please enter a dApp name');
      return;
    }

    const template = DAPP_TEMPLATES.find(t => t.id === selectedTemplate);
    if (!template) return;

    const newDApp: DApp = {
      id: Date.now().toString(),
      name: dappName,
      description: template.description,
      blockchain: selectedBlockchain,
      smartContracts: Array.from({ length: template.contracts }, (_, i) => ({
        id: `contract-${i}`,
        name: `${template.name} Contract ${i + 1}`,
        type: 'custom' as const,
        code: generateSolidityTemplate(template.id),
        deployed: false,
      })),
      features: [
        'Wallet Integration',
        'Transaction Handling',
        'Gas Optimization',
        'Event Logging',
      ],
      createdAt: new Date(),
    };

    setDapps([...dapps, newDApp]);
    setDappName('');
    setSelectedTemplate(null);
    setShowNameInput(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [dappName, selectedTemplate, selectedBlockchain, dapps]);

  const handleGenerateSolidity = useCallback((dappId: string) => {
    const dapp = dapps.find(d => d.id === dappId);
    if (!dapp) return;

    Alert.alert('Solidity Generated', `Generated ${dapp.smartContracts.length} smart contracts`);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [dapps]);

  const handleDeployContract = useCallback((dappId: string, contractId: string) => {
    const dapp = dapps.find(d => d.id === dappId);
    if (!dapp) return;

    Alert.alert('Deploying', `Deploying to ${dapp.blockchain}...`);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, [dapps]);

  const TemplateCard = ({ template }: { template: typeof DAPP_TEMPLATES[0] }) => (
    <Pressable
      onPress={() => handleCreateFromTemplate(template.id)}
      style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
      className="bg-surface rounded-2xl p-4 mb-3 border border-border"
    >
      <View className="gap-2">
        <View className="flex-row items-center gap-3">
          <Text className="text-3xl">{template.icon}</Text>
          <View className="flex-1">
            <Text className="text-lg font-bold text-foreground">{template.name}</Text>
            <Text className="text-xs text-muted">{template.contracts} contracts</Text>
          </View>
        </View>
        <Text className="text-sm text-muted">{template.description}</Text>
      </View>
    </Pressable>
  );

  const DAppCard = ({ dapp }: { dapp: DApp }) => (
    <Pressable
      style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
      className="bg-surface rounded-2xl p-4 mb-3 border border-border"
    >
      <View className="gap-3">
        <View>
          <Text className="text-lg font-bold text-foreground">{dapp.name}</Text>
          <Text className="text-xs text-primary mt-1 uppercase">{dapp.blockchain}</Text>
          <Text className="text-xs text-muted mt-1">{dapp.smartContracts.length} contracts</Text>
        </View>
        <View className="flex-row gap-2">
          <Pressable
            onPress={() => handleGenerateSolidity(dapp.id)}
            style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
            className="flex-1 bg-primary rounded-lg py-2 items-center"
          >
            <Text className="text-primaryForeground font-semibold text-sm">Generate</Text>
          </Pressable>
          <Pressable
            onPress={() => handleDeployContract(dapp.id, dapp.smartContracts[0]?.id || '')}
            style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
            className="flex-1 bg-primary/20 rounded-lg py-2 items-center"
          >
            <Text className="text-primary font-semibold text-sm">Deploy</Text>
          </Pressable>
        </View>
      </View>
    </Pressable>
  );

  return (
    <ScreenContainer className="p-0">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} className="flex-1">
        <View className="px-6 pt-6 pb-8 gap-6">
          {/* Header */}
          <View className="gap-2">
            <Text className="text-3xl font-bold text-foreground">dApp Builder</Text>
            <Text className="text-base text-muted">Create and deploy blockchain applications</Text>
          </View>

          {/* Quick Start */}
          <View className="bg-gradient-to-br from-primary/10 to-accent/10 rounded-2xl p-4 border border-primary/20 gap-2">
            <Text className="text-sm font-semibold text-primary">⛓️ Quick Start</Text>
            <Text className="text-lg font-bold text-foreground">Choose a Template</Text>
            <Text className="text-sm text-muted">Start with pre-built blockchain templates</Text>
          </View>

          {/* Templates */}
          <View className="gap-3">
            <View className="flex-row items-center justify-between">
              <Text className="text-lg font-bold text-foreground">dApp Templates</Text>
              <Pressable
                onPress={() => setShowTemplateModal(true)}
                style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
              >
                <Text className="text-primary font-semibold">View All →</Text>
              </Pressable>
            </View>
            {DAPP_TEMPLATES.slice(0, 3).map(template => (
              <TemplateCard key={template.id} template={template} />
            ))}
          </View>

          {/* Your dApps */}
          {dapps.length > 0 && (
            <View className="gap-3">
              <Text className="text-lg font-bold text-foreground">Your dApps ({dapps.length})</Text>
              {dapps.map(dapp => (
                <DAppCard key={dapp.id} dapp={dapp} />
              ))}
            </View>
          )}

          {/* Blockchains */}
          <View className="gap-3 mt-4">
            <Text className="text-lg font-bold text-foreground">Supported Blockchains</Text>
            {BLOCKCHAINS.map(chain => (
              <View key={chain.id} className="bg-surface rounded-2xl p-4 border border-border flex-row items-center gap-3">
                <Text className="text-2xl font-bold">{chain.icon}</Text>
                <View className="flex-1">
                  <Text className="font-semibold text-foreground">{chain.name}</Text>
                  <Text className="text-xs text-muted">Gas: {chain.gas} • Speed: {chain.speed}</Text>
                </View>
              </View>
            ))}
          </View>

          {/* Smart Contract Types */}
          <View className="gap-3 mt-4">
            <Text className="text-lg font-bold text-foreground">Smart Contract Types</Text>
            {SMART_CONTRACT_TYPES.map(type => (
              <View key={type.id} className="bg-surface rounded-2xl p-4 border border-border flex-row items-center gap-3">
                <Text className="text-2xl">{type.icon}</Text>
                <View className="flex-1">
                  <Text className="font-semibold text-foreground">{type.name}</Text>
                  <Text className="text-xs text-muted">{type.description}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      {/* Template Modal */}
      <Modal visible={showTemplateModal} animationType="slide" transparent>
        <View className="flex-1 bg-black/50">
          <View className="flex-1 bg-background mt-12 rounded-t-3xl">
            <View className="px-6 py-4 border-b border-border flex-row items-center justify-between">
              <Text className="text-xl font-bold text-foreground">All Templates</Text>
              <Pressable onPress={() => setShowTemplateModal(false)}>
                <Text className="text-2xl text-foreground">✕</Text>
              </Pressable>
            </View>
            <ScrollView className="flex-1 px-6 py-4">
              {DAPP_TEMPLATES.map(template => (
                <TemplateCard key={template.id} template={template} />
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* dApp Name Input Modal */}
      <Modal visible={showNameInput} animationType="slide" transparent>
        <View className="flex-1 bg-black/50 items-center justify-center">
          <View className="bg-background rounded-3xl p-6 w-5/6 gap-4">
            <Text className="text-xl font-bold text-foreground">Create New dApp</Text>
            <TextInput
              placeholder="Enter dApp name"
              value={dappName}
              onChangeText={setDappName}
              className="bg-surface border border-border rounded-lg p-3 text-foreground"
              placeholderTextColor="#999"
            />
            <View className="gap-2">
              <Text className="text-sm font-semibold text-foreground">Blockchain</Text>
              <View className="flex-row gap-2 flex-wrap">
                {(['ethereum', 'polygon', 'solana', 'arbitrum', 'optimism'] as const).map(chain => (
                  <Pressable
                    key={chain}
                    onPress={() => setSelectedBlockchain(chain)}
                    style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
                    className={`rounded-lg py-2 px-3 border ${
                      selectedBlockchain === chain ? 'bg-primary border-primary' : 'bg-surface border-border'
                    }`}
                  >
                    <Text className={`text-xs font-semibold ${selectedBlockchain === chain ? 'text-primaryForeground' : 'text-foreground'}`}>
                      {chain.charAt(0).toUpperCase() + chain.slice(1)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
            <View className="flex-row gap-3">
              <Pressable
                onPress={() => {
                  setDappName('');
                  setShowNameInput(false);
                }}
                style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
                className="flex-1 bg-surface border border-border rounded-lg py-3 items-center"
              >
                <Text className="text-foreground font-semibold">Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleCreateDApp}
                style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
                className="flex-1 bg-primary rounded-lg py-3 items-center"
              >
                <Text className="text-primaryForeground font-semibold">Create</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

function generateSolidityTemplate(templateId: string): string {
  const templates: Record<string, string> = {
    'erc20-token': `
pragma solidity ^0.8.0;

contract MyToken {
  string public name = "My Token";
  string public symbol = "MTK";
  uint8 public decimals = 18;
  uint256 public totalSupply;
  
  mapping(address => uint256) public balanceOf;
  
  constructor(uint256 initialSupply) {
    totalSupply = initialSupply * 10 ** uint256(decimals);
    balanceOf[msg.sender] = totalSupply;
  }
  
  function transfer(address to, uint256 value) public returns (bool) {
    require(balanceOf[msg.sender] >= value);
    balanceOf[msg.sender] -= value;
    balanceOf[to] += value;
    return true;
  }
}
    `.trim(),
    'nft-collection': `
pragma solidity ^0.8.0;

contract MyNFT {
  string public name = "My NFT";
  string public symbol = "MNFT";
  uint256 public tokenCounter = 0;
  
  mapping(uint256 => address) public tokenOwner;
  mapping(address => uint256) public balanceOf;
  
  function mint(string memory uri) public {
    tokenOwner[tokenCounter] = msg.sender;
    balanceOf[msg.sender]++;
    tokenCounter++;
  }
}
    `.trim(),
    'defi-swap': `
pragma solidity ^0.8.0;

contract SimpleSwap {
  mapping(address => uint256) public reserves;
  
  function deposit(address token) public payable {
    reserves[token] += msg.value;
  }
  
  function swap(address tokenIn, address tokenOut, uint256 amountIn) public {
    require(reserves[tokenIn] >= amountIn);
    reserves[tokenIn] -= amountIn;
    reserves[tokenOut] += amountIn;
  }
}
    `.trim(),
  };
  
  return templates[templateId] || '// Smart contract code will be generated here';
}
