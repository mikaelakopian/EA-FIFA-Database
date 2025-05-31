#!/usr/bin/env python3
"""
Test script to verify WebSocket JSON parsing fixes
"""
import asyncio
import websockets
import json
import time
import concurrent.futures
from typing import List

class WebSocketTester:
    def __init__(self, uri: str = "ws://localhost:8000/ws"):
        self.uri = uri
        self.messages_received = []
        self.json_errors = []
        
    async def test_connection(self):
        """Test basic WebSocket connection"""
        try:
            async with websockets.connect(self.uri) as websocket:
                print("✅ WebSocket connection successful")
                
                # Wait for connection message
                message = await asyncio.wait_for(websocket.recv(), timeout=5.0)
                data = json.loads(message)
                print(f"✅ Received connection message: {data.get('type')}")
                
                return True
        except Exception as e:
            print(f"❌ Connection failed: {e}")
            return False
    
    async def test_message_parsing(self, duration: int = 30):
        """Test message parsing for a specified duration"""
        print(f"🔍 Testing message parsing for {duration} seconds...")
        
        try:
            async with websockets.connect(self.uri) as websocket:
                start_time = time.time()
                message_count = 0
                
                while time.time() - start_time < duration:
                    try:
                        message = await asyncio.wait_for(websocket.recv(), timeout=1.0)
                        
                        # Try to parse JSON
                        try:
                            data = json.loads(message)
                            message_count += 1
                            self.messages_received.append(data)
                            
                            # Check for message_id (should be present in new implementation)
                            if 'message_id' in data:
                                print(f"✅ Message {message_count}: ID {data['message_id']}, Type: {data.get('type', 'unknown')}")
                            else:
                                print(f"⚠️  Message {message_count}: No message_id, Type: {data.get('type', 'unknown')}")
                                
                        except json.JSONDecodeError as je:
                            print(f"❌ JSON parsing error at position {je.pos}: {str(je)}")
                            print(f"   Raw message (first 200 chars): {message[:200]}")
                            self.json_errors.append({
                                'error': str(je),
                                'position': je.pos,
                                'message_preview': message[:200]
                            })
                            
                    except asyncio.TimeoutError:
                        # No message received, continue
                        continue
                
                print(f"✅ Test completed. Received {message_count} messages, {len(self.json_errors)} JSON errors")
                return len(self.json_errors) == 0
                
        except Exception as e:
            print(f"❌ Test failed: {e}")
            return False
    
    async def test_concurrent_connections(self, num_connections: int = 3):
        """Test multiple concurrent WebSocket connections"""
        print(f"🔀 Testing {num_connections} concurrent connections...")
        
        async def single_connection(conn_id: int):
            try:
                async with websockets.connect(self.uri) as websocket:
                    # Wait for connection message
                    message = await asyncio.wait_for(websocket.recv(), timeout=5.0)
                    data = json.loads(message)
                    print(f"✅ Connection {conn_id}: Connected, received {data.get('type')}")
                    
                    # Listen for a few more messages
                    for i in range(5):
                        try:
                            message = await asyncio.wait_for(websocket.recv(), timeout=2.0)
                            json.loads(message)  # Test JSON parsing
                        except asyncio.TimeoutError:
                            break
                        except json.JSONDecodeError as e:
                            print(f"❌ Connection {conn_id}: JSON error - {e}")
                            return False
                    
                    return True
            except Exception as e:
                print(f"❌ Connection {conn_id}: Failed - {e}")
                return False
        
        # Start all connections concurrently
        tasks = [single_connection(i) for i in range(num_connections)]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        successful = sum(1 for r in results if r is True)
        print(f"✅ {successful}/{num_connections} connections successful")
        
        return successful == num_connections
    
    async def test_server_status(self):
        """Test server status endpoint"""
        try:
            import aiohttp
            async with aiohttp.ClientSession() as session:
                async with session.get('http://localhost:8000/ws/status') as response:
                    if response.status == 200:
                        data = await response.json()
                        print(f"✅ Server status: {data}")
                        
                        # Check for new fields added in the fix
                        required_fields = ['active_connections', 'has_current_progress', 'queue_size', 'queue_processor_running']
                        missing_fields = [field for field in required_fields if field not in data]
                        
                        if missing_fields:
                            print(f"⚠️  Missing status fields: {missing_fields}")
                            return False
                        else:
                            print("✅ All expected status fields present")
                            return True
                    else:
                        print(f"❌ Status endpoint returned {response.status}")
                        return False
        except ImportError:
            print("⚠️  aiohttp not available, skipping status test")
            return True
        except Exception as e:
            print(f"❌ Status test failed: {e}")
            return False
    
    def print_summary(self):
        """Print test summary"""
        print("\n" + "="*50)
        print("📊 TEST SUMMARY")
        print("="*50)
        print(f"Total messages received: {len(self.messages_received)}")
        print(f"JSON parsing errors: {len(self.json_errors)}")
        
        if self.json_errors:
            print("\n❌ JSON ERRORS FOUND:")
            for i, error in enumerate(self.json_errors[:5]):  # Show first 5 errors
                print(f"  {i+1}. Position {error['position']}: {error['error']}")
                print(f"     Preview: {error['message_preview']}")
        else:
            print("\n✅ NO JSON PARSING ERRORS FOUND")
        
        # Check for message_id presence
        messages_with_id = sum(1 for msg in self.messages_received if 'message_id' in msg)
        if messages_with_id > 0:
            print(f"✅ {messages_with_id}/{len(self.messages_received)} messages have message_id (new feature working)")
        
        print("="*50)

async def main():
    """Run all WebSocket tests"""
    print("🚀 Starting WebSocket JSON Parsing Fix Tests")
    print("="*50)
    
    tester = WebSocketTester()
    
    # Test 1: Basic connection
    print("\n1️⃣  Testing basic connection...")
    conn_success = await tester.test_connection()
    
    # Test 2: Server status
    print("\n2️⃣  Testing server status endpoint...")
    status_success = await tester.test_server_status()
    
    # Test 3: Message parsing
    print("\n3️⃣  Testing message parsing...")
    parsing_success = await tester.test_message_parsing(duration=10)
    
    # Test 4: Concurrent connections
    print("\n4️⃣  Testing concurrent connections...")
    concurrent_success = await tester.test_concurrent_connections(num_connections=3)
    
    # Print summary
    tester.print_summary()
    
    # Overall result
    all_tests_passed = all([conn_success, status_success, parsing_success, concurrent_success])
    
    print(f"\n🎯 OVERALL RESULT: {'✅ ALL TESTS PASSED' if all_tests_passed else '❌ SOME TESTS FAILED'}")
    
    if not all_tests_passed:
        print("\n💡 If tests are failing:")
        print("   1. Make sure the FastAPI server is running")
        print("   2. Check that the WebSocket endpoint is available at /ws")
        print("   3. Verify the JSON parsing fixes are applied")
        print("   4. Check server logs for any errors")

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n⏹️  Tests interrupted by user")
    except Exception as e:
        print(f"\n💥 Test runner failed: {e}")