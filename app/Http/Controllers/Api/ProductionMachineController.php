<?php
namespace App\Http\Controllers\Api;
use App\Http\Controllers\Controller;
use App\Models\ProductionMachine;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
class ProductionMachineController extends Controller
{
 public function index(Request $request) { return response()->json(['success'=>true,'data'=>ProductionMachine::with('branch:id,code,name')->when($request->filled('search'),fn($q)=>$q->where('name','like','%'.$request->search.'%')->orWhere('machine_code','like','%'.$request->search.'%'))->orderBy('name')->get()]); }
 public function store(Request $request) { $machine=ProductionMachine::create($this->valid($request)); return response()->json(['success'=>true,'message'=>'Mesin berhasil ditambahkan.','data'=>$machine->load('branch:id,code,name')],201); }
 public function update(Request $request, ProductionMachine $productionMachine) { $productionMachine->update($this->valid($request,$productionMachine)); return response()->json(['success'=>true,'message'=>'Mesin berhasil diperbarui.','data'=>$productionMachine->fresh()->load('branch:id,code,name')]); }
 public function destroy(ProductionMachine $productionMachine) { $productionMachine->delete(); return response()->json(['success'=>true,'message'=>'Mesin berhasil dihapus.']); }
 private function valid(Request $request, ?ProductionMachine $machine=null): array { return $request->validate(['branch_id'=>['required','exists:branches,id'],'machine_code'=>['required','string','max:30',Rule::unique('production_machines','machine_code')->ignore($machine?->id)],'name'=>['required','string','max:150'],'type'=>['nullable','string','max:100'],'brand'=>['nullable','string','max:100'],'model'=>['nullable','string','max:100'],'hourly_cost'=>['nullable','numeric','min:0'],'is_active'=>['sometimes','boolean']]); }
}
